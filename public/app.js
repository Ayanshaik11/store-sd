const input = document.getElementById("photoInput");
const uploadBtn = document.getElementById("uploadBtn");
const selected = document.getElementById("selected");
const message = document.getElementById("message");
const gallery = document.getElementById("gallery");
const refreshBtn = document.getElementById("refreshBtn");

const progressWrap = document.getElementById("progressWrap");
const progressBar = document.getElementById("progressBar");
const progressText = document.getElementById("progressText");

const totalEl = document.getElementById("total");
const usedEl = document.getElementById("used");
const freeEl = document.getElementById("free");
const countEl = document.getElementById("count");
const storageFill = document.getElementById("storageFill");
const storagePercent = document.getElementById("storagePercent");
const statusDot = document.getElementById("statusDot");

const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightboxImg");
const closeLightbox = document.getElementById("closeLightbox");

let selectedFiles = [];

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return bytes + " B";

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }

  return value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2) + " " + units[unit];
}

function setMessage(text, type = "") {
  message.textContent = text;
  message.className = "message " + type;
}

function renderSelected() {
  selected.innerHTML = "";

  selectedFiles.forEach((file) => {
    const item = document.createElement("span");
    item.textContent = `${file.name} (${formatBytes(file.size)})`;
    selected.appendChild(item);
  });

  uploadBtn.disabled = selectedFiles.length === 0;
}

input.addEventListener("change", () => {
  selectedFiles = Array.from(input.files || []);

  const valid = selectedFiles.filter((file) => {
    const okType = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ].includes(file.type);

    const okSize = file.size <= 10 * 1024 * 1024;

    return okType && okSize;
  });

  if (valid.length !== selectedFiles.length) {
    setMessage("Some files were removed. Only supported images up to 10 MB are allowed.", "error");
  } else {
    setMessage("");
  }

  selectedFiles = valid.slice(0, 10);
  renderSelected();
});

function uploadFiles() {
  if (!selectedFiles.length) return;

  const formData = new FormData();

  selectedFiles.forEach((file) => {
    formData.append("photos", file);
  });

  uploadBtn.disabled = true;
  progressWrap.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressText.textContent = "Uploading…";
  setMessage("");

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/upload");

  xhr.upload.onprogress = (event) => {
    if (!event.lengthComputable) return;
    const percent = Math.round((event.loaded / event.total) * 100);
    progressBar.style.width = percent + "%";
    progressText.textContent = `Uploading… ${percent}%`;
  };

  xhr.onload = async () => {
    try {
      const data = JSON.parse(xhr.responseText);

      if (xhr.status >= 200 && xhr.status < 300) {
        setMessage(data.message || "Upload complete.", "ok");
        selectedFiles = [];
        input.value = "";
        renderSelected();
        await Promise.all([loadGallery(), loadStorage()]);
      } else {
        setMessage(data.error || "Upload failed.", "error");
      }
    } catch {
      setMessage("Upload failed.", "error");
    }

    progressWrap.classList.add("hidden");
    uploadBtn.disabled = selectedFiles.length === 0;
  };

  xhr.onerror = () => {
    progressWrap.classList.add("hidden");
    uploadBtn.disabled = false;
    setMessage("Network error. Check the server connection.", "error");
  };

  xhr.send(formData);
}

uploadBtn.addEventListener("click", uploadFiles);

async function loadGallery() {
  try {
    const response = await fetch("/api/photos", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) throw new Error(data.error || "Gallery error");

    gallery.innerHTML = "";

    if (!data.photos.length) {
      gallery.innerHTML = '<div class="empty">No photos yet. Be the first to upload one.</div>';
      return;
    }

    data.photos.forEach((photo) => {
      const box = document.createElement("div");
      box.className = "photo";

      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = photo.url;
      img.alt = "Uploaded photo";
      img.addEventListener("click", () => openLightbox(photo.url));

      box.appendChild(img);
      gallery.appendChild(box);
    });
  } catch (error) {
    gallery.innerHTML = '<div class="empty">Could not load the gallery.</div>';
  }
}

async function loadStorage() {
  try {
    const response = await fetch("/api/storage", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) throw new Error();

    countEl.textContent = data.photoCount;

    // The server reports actual filesystem capacity.
    if (data.diskTotalBytes !== null) {
      totalEl.textContent = formatBytes(data.diskTotalBytes);
      freeEl.textContent = formatBytes(data.diskFreeBytes);
      usedEl.textContent = formatBytes(data.diskUsedBytes);

      const usedPercent =
        data.diskTotalBytes > 0
          ? (data.diskUsedBytes / data.diskTotalBytes) * 100
          : 0;

      const safePercent = Math.min(100, Math.max(0, usedPercent));
      storageFill.style.width = safePercent.toFixed(2) + "%";
      storagePercent.textContent = `${safePercent.toFixed(1)}% of the storage is used`;
    } else {
      totalEl.textContent = "—";
      freeEl.textContent = "—";
      usedEl.textContent = formatBytes(data.photoBytes);
      storageFill.style.width = "0%";
      storagePercent.textContent =
        "Filesystem capacity is unavailable on this Node.js version.";
    }

    statusDot.classList.add("online");
  } catch {
    statusDot.classList.remove("online");
  }
}

function openLightbox(url) {
  lightboxImg.src = url;
  lightbox.classList.remove("hidden");
}

function closeViewer() {
  lightbox.classList.add("hidden");
  lightboxImg.src = "";
}

closeLightbox.addEventListener("click", closeViewer);
lightbox.addEventListener("click", (event) => {
  if (event.target === lightbox) closeViewer();
});

refreshBtn.addEventListener("click", async () => {
  refreshBtn.disabled = true;
  await Promise.all([loadGallery(), loadStorage()]);
  refreshBtn.disabled = false;
});

loadGallery();
loadStorage();

// Keep storage and gallery information reasonably fresh.
setInterval(loadStorage, 5000);
setInterval(loadGallery, 15000);
