const fileInput =
  document.getElementById("fileInput");

const uploadBtn =
  document.getElementById("uploadBtn");

const selectedFilesContainer =
  document.getElementById(
    "selectedFiles"
  );

const message =
  document.getElementById("message");

const gallery =
  document.getElementById("gallery");

const refreshBtn =
  document.getElementById(
    "refreshBtn"
  );

const storageText =
  document.getElementById(
    "storageText"
  );

const storageProgress =
  document.getElementById(
    "storageProgress"
  );

const usedText =
  document.getElementById(
    "usedText"
  );

const freeText =
  document.getElementById(
    "freeText"
  );

const fileCount =
  document.getElementById(
    "fileCount"
  );

const uploadProgressContainer =
  document.getElementById(
    "uploadProgressContainer"
  );

const uploadProgressBar =
  document.getElementById(
    "uploadProgressBar"
  );

const uploadProgressText =
  document.getElementById(
    "uploadProgressText"
  );

const lightbox =
  document.getElementById(
    "lightbox"
  );

const lightboxContent =
  document.getElementById(
    "lightboxContent"
  );

const closeLightbox =
  document.getElementById(
    "closeLightbox"
  );


let selectedFiles = [];


// --------------------------------------------------
// Helpers
// --------------------------------------------------

function formatBytes(bytes) {

  if (
    bytes === null ||
    bytes === undefined ||
    Number.isNaN(bytes)
  ) {
    return "-";
  }

  if (bytes === 0) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB"
  ];

  const index = Math.floor(
    Math.log(bytes) /
      Math.log(1024)
  );

  const safeIndex = Math.min(
    index,
    units.length - 1
  );

  const value =
    bytes /
    Math.pow(
      1024,
      safeIndex
    );

  return (
    value.toFixed(
      value >= 10 ? 0 : 1
    ) +
    " " +
    units[safeIndex]
  );
}


function showMessage(
  text,
  type = ""
) {

  message.textContent = text;

  message.className =
    "message " + type;
}


// --------------------------------------------------
// File selection
// --------------------------------------------------

fileInput.addEventListener(
  "change",
  () => {

    const files = Array.from(
      fileInput.files
    );

    selectedFiles =
      files.filter((file) => {

        return (
          file.type.startsWith(
            "image/"
          ) ||
          file.type.startsWith(
            "video/"
          )
        );

      });


    if (
      selectedFiles.length !==
      files.length
    ) {

      showMessage(
        "Some files were ignored because they are not photos or videos.",
        "error"
      );

    } else {

      showMessage("");

    }


    renderSelectedFiles();

    uploadBtn.disabled =
      selectedFiles.length === 0;
  }
);


// --------------------------------------------------
// Selected files preview
// --------------------------------------------------

function renderSelectedFiles() {

  selectedFilesContainer.innerHTML =
    "";


  if (
    selectedFiles.length === 0
  ) {

    return;
  }


  selectedFiles.forEach(
    (file, index) => {

      const item =
        document.createElement(
          "div"
        );

      item.className =
        "selected-file";


      const name =
        document.createElement(
          "span"
        );

      name.textContent =
        file.name;


      const size =
        document.createElement(
          "small"
        );

      size.textContent =
        formatBytes(
          file.size
        );


      const remove =
        document.createElement(
          "button"
        );

      remove.textContent =
        "✕";

      remove.type =
        "button";

      remove.addEventListener(
        "click",
        () => {

          selectedFiles.splice(
            index,
            1
          );

          renderSelectedFiles();

          uploadBtn.disabled =
            selectedFiles.length ===
            0;

        }
      );


      item.appendChild(name);

      item.appendChild(size);

      item.appendChild(remove);

      selectedFilesContainer.appendChild(
        item
      );

    }
  );
}


// --------------------------------------------------
// Upload
// --------------------------------------------------

uploadBtn.addEventListener(
  "click",
  uploadFiles
);


function uploadFiles() {

  if (
    selectedFiles.length === 0
  ) {

    return;
  }


  if (
    selectedFiles.length > 10
  ) {

    showMessage(
      "Maximum 10 files per upload.",
      "error"
    );

    return;
  }


  const formData =
    new FormData();


  selectedFiles.forEach(
    (file) => {

      formData.append(
        "files",
        file
      );

    }
  );


  uploadBtn.disabled =
    true;

  uploadProgressContainer.hidden =
    false;

  uploadProgressBar.style.width =
    "0%";

  uploadProgressText.textContent =
    "Uploading...";


  const xhr =
    new XMLHttpRequest();


  xhr.open(
    "POST",
    "/api/upload"
  );


  // Upload progress
  xhr.upload.addEventListener(
    "progress",
    (event) => {

      if (!event.lengthComputable) {
        return;
      }

      const percent =
        Math.round(
          (event.loaded /
            event.total) *
            100
        );

      uploadProgressBar.style.width =
        percent + "%";

      uploadProgressText.textContent =
        `Uploading... ${percent}%`;

    }
  );


  xhr.addEventListener(
    "load",
    () => {

      let data = {};

      try {

        data =
          JSON.parse(
            xhr.responseText
          );

      } catch (error) {

        data = {};

      }


      if (
        xhr.status >= 200 &&
        xhr.status < 300
      ) {

        showMessage(
          data.message ||
            "Upload successful!",
          "success"
        );


        selectedFiles = [];

        fileInput.value = "";

        renderSelectedFiles();


        uploadProgressBar.style.width =
          "100%";

        uploadProgressText.textContent =
          "Upload complete!";


        loadGallery();

        loadStorage();


        setTimeout(
          () => {

            uploadProgressContainer.hidden =
              true;

          },
          1500
        );

      } else {

        showMessage(
          data.error ||
            "Upload failed.",
          "error"
        );

        uploadProgressContainer.hidden =
          true;

      }


      uploadBtn.disabled =
        selectedFiles.length === 0;

    }
  );


  xhr.addEventListener(
    "error",
    () => {

      showMessage(
        "Network error. Upload failed.",
        "error"
      );

      uploadProgressContainer.hidden =
        true;

      uploadBtn.disabled =
        selectedFiles.length === 0;

    }
  );


  xhr.addEventListener(
    "abort",
    () => {

      showMessage(
        "Upload cancelled.",
        "error"
      );

      uploadProgressContainer.hidden =
        true;

      uploadBtn.disabled =
        selectedFiles.length === 0;

    }
  );


  xhr.send(formData);
}


// --------------------------------------------------
// Storage
// --------------------------------------------------

async function loadStorage() {

  try {

    const response =
      await fetch(
        "/api/storage"
      );


    if (!response.ok) {
      throw new Error(
        "Storage request failed"
      );
    }


    const data =
      await response.json();


    usedText.textContent =
      "Used: " +
      formatBytes(
        data.usedBytes
      );


    freeText.textContent =
      "Free: " +
      formatBytes(
        data.freeBytes
      );


    fileCount.textContent =
      data.fileCount;


    if (
      data.totalBytes !== null &&
      data.freeBytes !== null
    ) {

      const usedPercent =
        (
          data.usedBytes /
          data.totalBytes
        ) *
        100;


      storageText.textContent =
        `${usedPercent.toFixed(1)}% used`;


      storageProgress.style.width =
        Math.min(
          usedPercent,
          100
        ) + "%";

    } else {

      storageText.textContent =
        "Storage available";

      storageProgress.style.width =
        "0%";

    }

  } catch (error) {

    console.error(error);

    storageText.textContent =
      "Unavailable";

  }
}


// --------------------------------------------------
// Gallery
// --------------------------------------------------

async function loadGallery() {

  gallery.innerHTML =
    `<div class="loading">
      Loading gallery...
    </div>`;


  try {

    const response =
      await fetch(
        "/api/files"
      );


    if (!response.ok) {

      throw new Error(
        "Gallery request failed"
      );

    }


    const data =
      await response.json();


    renderGallery(
      data.files || []
    );

  } catch (error) {

    console.error(error);

    gallery.innerHTML =
      `<div class="empty">
        Could not load gallery.
      </div>`;

  }
}


// --------------------------------------------------
// Render gallery
// --------------------------------------------------

function renderGallery(
  files
) {

  gallery.innerHTML =
    "";


  if (
    files.length === 0
  ) {

    gallery.innerHTML =
      `<div class="empty">
        No photos or videos uploaded yet.
      </div>`;

    return;
  }


  files.forEach(
    (file) => {

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "photo";


      // VIDEO
      if (
        file.type === "video"
      ) {

        const video =
          document.createElement(
            "video"
          );


        video.src =
          file.url;

        video.controls =
          true;

        video.preload =
          "metadata";

        video.playsInline =
          true;


        card.appendChild(
          video
        );

      }


      // IMAGE
      else {

        const img =
          document.createElement(
            "img"
          );


        img.src =
          file.url;

        img.alt =
          "Uploaded photo";

        img.loading =
          "lazy";


        img.addEventListener(
          "click",
          () => {

            openLightbox(
              file.url
            );

          }
        );


        card.appendChild(
          img
        );

      }


      // File information

      const info =
        document.createElement(
          "div"
        );

      info.className =
        "photo-info";


      const type =
        document.createElement(
          "span"
        );

      type.textContent =
        file.type === "video"
          ? "🎬 Video"
          : "🖼️ Photo";


      const size =
        document.createElement(
          "span"
        );

      size.textContent =
        formatBytes(
          file.size
        );


      info.appendChild(
        type
      );

      info.appendChild(
        size
      );


      card.appendChild(
        info
      );


      gallery.appendChild(
        card
      );

    }
  );
}


// --------------------------------------------------
// Lightbox
// --------------------------------------------------

function openLightbox(
  url
) {

  lightboxContent.innerHTML =
    "";


  const img =
    document.createElement(
      "img"
    );


  img.src =
    url;

  img.alt =
    "Full size image";


  lightboxContent.appendChild(
    img
  );


  lightbox.hidden =
    false;

  document.body.style.overflow =
    "hidden";
}


function closeLightboxWindow() {

  lightbox.hidden =
    true;

  lightboxContent.innerHTML =
    "";

  document.body.style.overflow =
    "";
}


closeLightbox.addEventListener(
  "click",
  closeLightboxWindow
);


lightbox.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      lightbox
    ) {

      closeLightboxWindow();

    }

  }
);


// --------------------------------------------------
// Refresh
// --------------------------------------------------

refreshBtn.addEventListener(
  "click",
  () => {

    loadGallery();

    loadStorage();

  }
);


// --------------------------------------------------
// Initial load
// --------------------------------------------------

loadGallery();

loadStorage();


// Refresh storage periodically
setInterval(
  loadStorage,
  10000
);