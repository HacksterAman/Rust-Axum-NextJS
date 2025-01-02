"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const uploadFileInChunks = async () => {
    if (!file) {
      alert("Please select a file to upload");
      return;
    }

    const chunkSize = 1 * 1024 * 1024; // 1 MB
    const totalChunks = Math.ceil(file.size / chunkSize);
    let currentChunk = Number(localStorage.getItem(file.name)) || 0;

    setProgress(0);
    setStatus("Uploading...");

    while (currentChunk < totalChunks) {
      const start = currentChunk * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);

      const formData = new FormData();
      formData.append("chunk", chunk);
      formData.append("fileName", file.name);
      formData.append("chunkNumber", currentChunk.toString());
      formData.append("totalChunks", totalChunks.toString());

      try {
        const response = await fetch("http://localhost:8001/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) throw new Error("Chunk upload failed");

        currentChunk++;
        localStorage.setItem(file.name, currentChunk.toString());
        setProgress(Math.round((currentChunk / totalChunks) * 100));
      } catch (error) {
        console.error(error);
        setStatus("Error during file upload.");
        return;
      }
    }

    localStorage.removeItem(file.name);
    setUploadedFileName(file.name);
    setStatus("File uploaded successfully!");
  };

  const downloadFileInChunks = async () => {
    if (!uploadedFileName) {
      alert("No file available for download. Please upload a file first.");
      return;
    }

    try {
      setProgress(0);
      setStatus("Downloading...");

      const chunkSize = 1 * 1024 * 1024; // 1 MB
      let downloadedBytes = 0;

      // Request a handle to save the file
      const handle = await window.showSaveFilePicker({
        suggestedName: uploadedFileName,
      });

      const writable = await handle.createWritable();

      // Get the total file size from the first request
      const initialResponse = await fetch(
        `http://localhost:8001/download?fileName=${uploadedFileName}`
      );

      if (!initialResponse.ok) throw new Error("Failed to fetch file size");

      const totalSize = parseInt(
        initialResponse.headers.get("Content-Length") || "0",
        10
      );

      while (downloadedBytes < totalSize) {
        const rangeHeaders = new Headers({
          Range: `bytes=${downloadedBytes}-${Math.min(
            downloadedBytes + chunkSize - 1,
            totalSize - 1
          )}`,
        });

        const response = await fetch(
          `http://localhost:8001/download?fileName=${uploadedFileName}`,
          { headers: rangeHeaders }
        );

        if (!response.ok) throw new Error("Chunk download failed");

        const chunk = await response.arrayBuffer();
        await writable.write(chunk);

        downloadedBytes += chunk.byteLength;
        setProgress(Math.round((downloadedBytes / totalSize) * 100));
      }

      await writable.close();
      setStatus("File downloaded successfully!");
    } catch (error) {
      console.error("Error downloading file:", error);
      setStatus("Error during file download.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Chunked File Upload</h1>
      <input
        type="file"
        onChange={handleFileChange}
        className="mb-4 p-2 border border-gray-300 rounded"
      />
      <button
        onClick={uploadFileInChunks}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Upload
      </button>
      <progress value={progress} max="100" className="mt-4 w-full" />
      <p className="mt-2">{status}</p>

      <h1 className="text-2xl font-bold mt-8">Chunked File Download</h1>
      <button
        onClick={downloadFileInChunks}
        className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mt-4"
      >
        Download Uploaded File
      </button>
    </div>
  );
}
