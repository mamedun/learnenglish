import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [apiIndex, apiBootstrap, apiCatalog, apiCourseware, adminPage, imageGenPanel, mediaModal, courseStudio] =
  await Promise.all([
    read("api/index.php"),
    read("api/bootstrap.php"),
    read("api/catalog.php"),
    read("api/courseware.php"),
    read("src/features/admin/AdminPage.jsx"),
    read("src/features/admin/AdminImageGeneratorPanel.jsx"),
    read("src/components/MediaLibraryModal.jsx"),
    read("src/features/admin/CourseStudio.jsx"),
  ]);

// 1. Verify backend endpoints in api/index.php
assert.match(apiIndex, /admin\/generate-image/);
assert.match(apiIndex, /admin_generate_image_ai/);
assert.match(apiIndex, /app_media_dir/);
assert.match(apiIndex, /admin\/media/);
assert.match(apiIndex, /DELETE/);
assert.match(apiIndex, /api\/uploads\/media/);

// 2. Verify bootstrap, catalog, and courseware allow media uploads
assert.match(apiBootstrap, /\/uploads\/media\//);
assert.match(apiCatalog, /api\/uploads\/media/);
assert.match(apiCourseware, /api\/uploads\/media/);

// 3. Verify AdminPage has Image Generator tab
assert.match(adminPage, /AdminImageGeneratorPanel/);
assert.match(adminPage, /Image Generator/);
assert.match(adminPage, /adminTab === "media"/);

// 4. Verify AdminImageGeneratorPanel features
assert.match(imageGenPanel, /ASPECT_RATIOS/);
assert.match(imageGenPanel, /16:9/);
assert.match(imageGenPanel, /1:1/);
assert.match(imageGenPanel, /handleGenerate/);
assert.match(imageGenPanel, /handleSaveImage/);
assert.match(imageGenPanel, /copyToClipboard/);
assert.match(imageGenPanel, /handleDeleteMedia/);
assert.match(imageGenPanel, /api\/uploads\/media\//);

// 5. Verify MediaLibraryModal and CourseStudio integration
assert.match(mediaModal, /MediaLibraryModal/);
assert.match(mediaModal, /onSelect/);
assert.match(courseStudio, /MediaLibraryModal/);
assert.match(courseStudio, /openMediaPicker/);
assert.match(courseStudio, /Pilih Gambar/);

console.log("PASS: Admin Image Generator, media management endpoints, and Course Studio media picker verified.");
