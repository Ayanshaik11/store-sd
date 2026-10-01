const express = require("express");
const multer = require("multer");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// CHANGE THIS to your Android SD-card path.
// Example: /storage/1234-ABCD/PhotoStorage
// Find your SD-card ID with: ls /storage
// ============================================================
const PHOTO_DIR =
  process.env.PHOTO_DIR || "/storage/XXXX-XXXX/PhotoStorage";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_FILES_PER_UPLOAD = 10;

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif"
]);

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif"
]);

if (PHOTO_DIR.includes("XXXX-XXXX")) {
  console.warn(
    "\n⚠️  PHOTO_DIR is still using the placeholder.\n" +
    "Edit server.js or set PHOTO_DIR before starting the server.\n"
  );
}

fs.mkdirSync(PHOTO_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Try again later." }
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, PHOTO_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = allowedExtensions.has(ext) ? ext : ".jpg";
    const name =
      Date.now() +
      "-" +
      crypto.randomBytes(8).toString("hex") +
      safeExt;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES_PER_UPLOAD
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (
      allowedMimeTypes.has(file.mimetype) &&
      allowedExtensions.has(ext)
    ) {
      return cb(null, true);
    }

    cb(new Error("Only JPG, PNG, WEBP and GIF images are allowed."));
  }
});

function isInsidePhotoDir(fileName) {
  const resolvedDir = path.resolve(PHOTO_DIR);
  const resolvedFile = path.resolve(PHOTO_DIR, fileName);
  return (
    resolvedFile.startsWith(resolvedDir + path.sep) &&
    path.basename(resolvedFile) === fileName
  );
}

function getPhotoFiles() {
  return fs
    .readdirSync(PHOTO_DIR, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isFile()) return false;
      const ext = path.extname(entry.name).toLowerCase();
      return allowedExtensions.has(ext);
    })
    .map((entry) => {
      const full = path.join(PHOTO_DIR, entry.name);
      const stat = fs.statSync(full);
      return {
        name: entry.name,
        url: "/photos/" + encodeURIComponent(entry.name),
        size: stat.size,
        modified: stat.mtimeMs
      };
    })
    .sort((a, b) => b.modified - a.modified);
}

function getStorageStatus() {
  const files = getPhotoFiles();
  const usedBytes = files.reduce((sum, file) => sum + file.size, 0);

  // statfsSync is available on modern Node.js versions.
  let totalBytes = null;
  let freeBytes = null;

  try {
    const stat = fs.statfsSync(PHOTO_DIR);
    totalBytes = stat.blocks * stat.bsize;
    freeBytes = stat.bavail * stat.bsize;
  } catch (error) {
    // Fallback: report folder usage only if filesystem stats aren't available.
  }

  const diskUsedBytes =
    totalBytes !== null && freeBytes !== null
      ? Math.max(0, totalBytes - freeBytes)
      : null;

  return {
    photoCount: files.length,
    photoBytes: usedBytes,
    diskTotalBytes: totalBytes,
    diskFreeBytes: freeBytes,
    diskUsedBytes,
    updatedAt: new Date().toISOString()
  };
}

app.get("/api/photos", (_req, res) => {
  try {
    res.json({
      photos: getPhotoFiles()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not read gallery." });
  }
});

app.get("/api/storage", (_req, res) => {
  try {
    res.json(getStorageStatus());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not read storage status." });
  }
});

app.get("/photos/:name", (req, res) => {
  const name = path.basename(req.params.name);

  if (!isInsidePhotoDir(name)) {
    return res.status(400).send("Invalid file name.");
  }

  const filePath = path.join(PHOTO_DIR, name);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("Photo not found.");
  }

  res.sendFile(filePath);
});

app.post(
  "/api/upload",
  uploadLimiter,
  upload.array("photos", MAX_FILES_PER_UPLOAD),
  (req, res) => {
    const uploaded = (req.files || []).map((file) => ({
      name: file.filename,
      url: "/photos/" + encodeURIComponent(file.filename),
      size: file.size
    }));

    res.status(201).json({
      message: `${uploaded.length} photo(s) uploaded.`,
      photos: uploaded
    });
  }
);

app.delete("/api/photos/:name", (req, res) => {
  const name = path.basename(req.params.name);

  if (!isInsidePhotoDir(name)) {
    return res.status(400).json({ error: "Invalid file name." });
  }

  const filePath = path.join(PHOTO_DIR, name);

  // Deleting is intentionally disabled by default for a public upload service.
  // Enable it only after adding authentication/admin protection.
  return res.status(403).json({
    error: "Photo deletion is disabled."
  });
});

app.use((error, _req, res, _next) => {
  console.error(error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({
        error: `Each photo must be ${MAX_FILE_SIZE_MB} MB or smaller.`
      });
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(413).json({
        error: `Maximum ${MAX_FILES_PER_UPLOAD} photos per upload.`
      });
    }

    return res.status(400).json({ error: error.message });
  }

  res.status(400).json({
    error: error.message || "Upload failed."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`
📸 Photo Storage Web App
────────────────────────────────────
Server: http://0.0.0.0:${PORT}
Photo folder: ${PHOTO_DIR}

Upload limit: ${MAX_FILE_SIZE_MB} MB per photo
Max photos per request: ${MAX_FILES_PER_UPLOAD}

Open locally:
  http://127.0.0.1:${PORT}

For internet access, use a secure tunnel such as Cloudflare Tunnel.
`);
});
