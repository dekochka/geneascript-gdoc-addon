# Project: Drive Folder Importer (Doc Builder)

## 1. Overview

**Feature:** Drive Folder Importer ("Doc Builder")
**Goal:** Automate the preparation of a Google Document for batch metric book transcription. Instead of users manually inserting 50+ high-resolution archival scans into a Google Doc, the script will prompt for a Google Drive Folder URL, extract the images, sort them, insert the required Context block, and append the images sequentially with proper spacing/page breaks.

## 2. User Flow

1. User opens a blank Google Document.
2. User clicks the menu: **Extensions -> Metric Book Transcriber -> Import Book from Drive Folder**.
3. A prompt dialog appears asking: "Enter the Google Drive Folder ID or URL containing the metric book scans.
4. User pastes the link and clicks OK. First Version to support up to 30 images.
5. A toast/alert notifies the user: "Importing X images. Please wait..."
6. The script processes the folder:

- Injects the `Context` template at the very top of the document (if not already present).
- Appends each image from the folder in alphabetical order.
- Resizes images to fit the document width.
- Inserts a page break after each image.

1. A final alert notifies the user of completion.

## 3. Technical Requirements

### 3.1. UI Updates (`Code.gs`)

- Update the `onOpen` function to include a new menu item: `'Import Book from Drive Folder'` mapped to the function `importFromDriveFolder`.

### 3.2. Input Parsing

- Create a helper function `extractFolderId(input)` to handle both raw Folder IDs and full Google Drive URLs.
- *Regex hint:* `[-\w]{25,}` is standard for Drive IDs.

### 3.3. Drive API Integration

- Use `DriveApp.getFolderById(folderId)`.
- Fetch files iterating via `folder.getFiles()`.
- Filter files to only include images (MIME types: `image/jpeg`, `image/png`, `image/webp`).
- Store files in an array and **sort them alphabetically by filename** to ensure Page 1, Page 2, Page 10 sort correctly (natural sort implementation preferred to avoid `Page 10` appearing before `Page 2`).

### 3.4. Document Manipulation

- **Context Block:** Check if the document already contains the `CONTEXT_HEADING` (currently 'Context'). If not, insert the word "Context" as a Heading 1 at the top of the document, followed by a placeholder paragraph (e.g., `[Paste your archival signatures, village names, and common surnames here]`), followed by a Page Break.

#### Context Template 

----------------------------
Context 

**ARCHIVE NAME**: ДАЙФО
**ARCHIVE_REFERENCE**: Ф. 631, оп. 12, спр. 33
**DOCUMENT_DESCRIPTION**: «Метрична книга церкви реєстрації народження, шлюбу та смерті» для с. Темирівці, с. Селище, с. Крилос, с. Козина 
**DATE_RANGE**: 11.01.1885–15.12.1942
**VILLAGES**: 
Основные села прихода:
Темеровці (Temerowce) - центр прихода, гміна
Селище (Sieliska)

Близлежащие села, которые могли относиться к приходу Темеровці или быть упомянуты в записях:
Колодиев (Kołodziejów)
Крылос (Kryłos)
Козина (Kozyna)
Нимшин (Nimszyn)
Остров (Ostrów)
Пукасовцы (Pukasowce)
Сапогов (Sapohów)
Слободка (Słobódka)
Хоростков (Chorostków)

**COMMON_SURNAMES**: 
Дубель (Dubel)
Рега (Rega)
Балащук (Balaszczuk)
Шотурма (Szoturma)
Гулик (Hulick)
----------------------------

- **Image Insertion:**
- Loop through the sorted image array.
- Get the image Blob: `file.getBlob()`.
- Append the image to the document: `body.appendImage(blob)`.
- **Crucial Layout Fix:** Archival scans are often 4K+ resolution. Calculate the document's page width (page width minus left/right margins) and scale the image down proportionally using `image.setWidth()` and `image.setHeight()` so it fits neatly on the page without breaching GDoc limits.
- Append a Page Break `body.appendPageBreak()` after each image to isolate records.

## 4. Implementation Steps for Cursor

1. **Step 1: Menu Addition**

- Modify `onOpen()` in `Code.gs` to add the new menu item.

1. **Step 2: ID Extractor Logic**

- Implement `extractFolderId(urlOrId)`. Return `null` if invalid.

1. **Step 3: Main Importer Function**

- Implement `importFromDriveFolder()`.
- Add UI prompts for the folder link.
- Add a `try...catch` block to handle permissions errors or "Folder Not Found" errors.

1. **Step 4: Sorting & Filtering**

- Fetch files, filter by `MIME_TYPE`, and apply a natural sort algorithm to the filenames.

1. **Step 5: Document Formatting**

- Implement the logic to prepend the `Context` block.
- Implement the loop to insert, scale, and paginate the images.

## 5. Edge Cases & Error Handling

- **Empty Folder / No Images:** Alert the user "No images found in this folder."
- **Invalid URL:** Alert the user "Invalid Drive Folder link. Please check the URL."
- **Permissions:** If `DriveApp` throws an access denied error, alert the user "Cannot access folder. Please ensure the folder is shared with you or you are the owner."
- **Execution Timeout:** Google Apps Script has a 6-minute limit. For 50-100 images, standard insertion should pass, but add `Logger.log` statements tracking the index to help debug if large folders time out.
- **Natural Sort:** Ensure `image_2.jpg` comes *before* `image_10.jpg`. Standard JavaScript `.sort()` will do 1, 10, 2 without a custom comparator.

