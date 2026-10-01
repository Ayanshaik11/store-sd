const express = require("express");
const multer = require("multer");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

// SD card storage location
const STORAGE_DIR =
  process.env.PHOTO_DIR ||
  "/storage/81CD-151D/PhotoStorage";

// Maximum number of files in one upload.
// There is NO file-size limit.
const MAX_FILES_PER_UPLOAD = 10;

// Supported file types
const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",

  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska"
]);

const allowedExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",

  ".mp4",
  ".webm",
  ".mov",
  ".mkv"
]);

// Create storage directory if it doesn't exist
fs.mkdirSync(STORAGE_DIR, {
  recursive: true
});

app.use(cors());

app.use(
  express.json({
    limit: "1mb"
  })
);

// Serve website
app.use(
  express.static(
    path.join(__dirname, "public")
  )
);

// Upload rate limit
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error:
      "Too many upload requests. Please try again later."
  }
});

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, STORAGE_DIR);
  },

  filename: (_req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const safeExtension =
      allowedExtensions.has(extension)
        ? extension
        : ".jpg";

    const filename =
      Date.now() +
      "-" +
      crypto.randomBytes(8).toString("hex") +
      safeExtension;

    cb(null, filename);
  }
});

// Multer configuration
const upload = multer({
  storage,

  // IMPORTANT:
  // No fileSize limit here.
  limits: {
    files: MAX_FILES_PER_UPLOAD
  },

  fileFilter: (_req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const validMime =
      allowedMimeTypes.has(file.mimetype);

    const validExtension =
      allowedExtensions.has(extension);

    if (validMime && validExtension) {
      cb(null, true);
      return;
    }

    cb(
      new Error(
        "Only JPG, JPEG, PNG, WEBP, GIF, MP4, WEBM, MOV and MKV files are allowed."
      )
    );
  }
});

// --------------------------------------------------
// Helper: get all uploaded files
// --------------------------------------------------

function getFiles() {
  if (!fs.existsSync(STORAGE_DIR)) {
    return [];
  }

  return fs
    .readdirSync(STORAGE_DIR, {
      withFileTypes: true
    })
    .filter((entry) => {
      if (!entry.isFile()) {
        return false;
      }

      const extension = path
        .extname(entry.name)
        .toLowerCase();

      return allowedExtensions.has(extension);
    })
    .map((entry) => {
      const filePath = path.join(
        STORAGE_DIR,
        entry.name
      );

      const stat = fs.statSync(filePath);

      const extension = path
        .extname(entry.name)
        .toLowerCase();

      const isVideo = [
        ".mp4",
        ".webm",
        ".mov",
        ".mkv"
      ].includes(extension);

      return {
        name: entry.name,

        url:
          "/files/" +
          encodeURIComponent(entry.name),

        size: stat.size,

        type: isVideo
          ? "video"
          : "image",

        modified: stat.mtimeMs
      };
    })
    .sort((a, b) => {
      return b.modified - a.modified;
    });
}

// --------------------------------------------------
// Helper: storage information
// --------------------------------------------------

function getStorageStatus() {
  const files = getFiles();

  const uploadedBytes = files.reduce(
    (total, file) => {
      return total + file.size;
    },
    0
  );

  let totalBytes = null;
  let freeBytes = null;

  try {
    const stat = fs.statfsSync(
      STORAGE_DIR
    );

    totalBytes =
      stat.blocks * stat.bsize;

    freeBytes =
      stat.bavail * stat.bsize;
  } catch (error) {
    console.log(
      "Could not read filesystem storage information."
    );
  }

  const usedBytes =
    totalBytes !== null &&
    freeBytes !== null
      ? totalBytes - freeBytes
      : null;

  return {
    totalBytes,
    usedBytes,
    freeBytes,

    uploadedBytes,

    fileCount: files.length,

    updatedAt:
      new Date().toISOString()
  };
}

// --------------------------------------------------
// API: Gallery
// --------------------------------------------------

app.get("/api/files", (_req, res) => {
  try {
    const files = getFiles();

    res.json({
      files
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not load gallery."
    });
  }
});

// --------------------------------------------------
// API: Storage status
// --------------------------------------------------

app.get("/api/storage", (_req, res) => {
  try {
    res.json(
      getStorageStatus()
    );
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Could not read storage information."
    });
  }
});

// --------------------------------------------------
// Serve uploaded files
// --------------------------------------------------

app.get("/files/:name", (req, res) => {
  const name = path.basename(
    req.params.name
  );

  if (
    name !== req.params.name ||
    name.includes("..")
  ) {
    return res
      .status(400)
      .send("Invalid file name.");
  }

  const filePath = path.join(
    STORAGE_DIR,
    name
  );

  if (!fs.existsSync(filePath)) {
    return res
      .status(404)
      .send("File not found.");
  }

  res.sendFile(filePath);
});

// --------------------------------------------------
// Upload files
// --------------------------------------------------

app.post(
  "/api/upload",

  uploadLimiter,

  upload.array(
    "files",
    MAX_FILES_PER_UPLOAD
  ),

  (req, res) => {
    const uploaded =
      req.files || [];

    const result = uploaded.map(
      (file) => ({
        name: file.filename,

        url:
          "/files/" +
          encodeURIComponent(
            file.filename
          ),

        size: file.size,

        type:
          file.mimetype.startsWith(
            "video/"
          )
            ? "video"
            : "image"
      })
    );

    res.status(201).json({
      message:
        `${result.length} file(s) uploaded successfully.`,

      files: result
    });
  }
);

// --------------------------------------------------
// Error handling
// --------------------------------------------------

app.use(
  (
    error,
    _req,
    res,
    _next
  ) => {
    console.error(error);

    if (
      error instanceof
      multer.MulterError
    ) {
      if (
        error.code ===
        "LIMIT_FILE_COUNT"
      ) {
        return res.status(413).json({
          error:
            `Maximum ${MAX_FILES_PER_UPLOAD} files per upload.`
        });
      }

      return res.status(400).json({
        error: error.message
      });
    }

    res.status(400).json({
      error:
        error.message ||
        "Upload failed."
    });
  }
);

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "================================"
    );
    console.log(
      "     PHOTO + VIDEO STORAGE"
    );
    console.log(
      "================================"
    );

    console.log(
      `Server: http://0.0.0.0:${PORT}`
    );

    console.log(
      `Storage: ${STORAGE_DIR}`
    );

    console.log(
      "File size limit: NONE"
    );

    console.log(
      "Maximum files per upload: " +
        MAX_FILES_PER_UPLOAD
    );

    console.log(
      "================================"
    );
    console.log("");
  }
);