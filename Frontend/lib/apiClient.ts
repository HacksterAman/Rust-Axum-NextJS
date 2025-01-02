const downloadFileDirectlyToDisk = async (fileName: string) => {
  try {
    setProgress(0);
    setStatus("Downloading...");

    // Request a handle to save the file
    const handle = await window.showSaveFilePicker({
      suggestedName: fileName,
    });

    // Create a writable stream to write directly to disk
    const writable = await handle.createWritable();

    // Fetch the file as a stream
    const response = await fetch(
      `http://localhost:8001/download?fileName=${fileName}`
    );

    if (!response.ok || !response.body) {
      throw new Error("Failed to fetch file stream.");
    }

    // Get the ReadableStream from the response and pipe it to disk
    const reader = response.body.getReader();
    const chunkSize = 1 * 1024 * 1024; // 1 MB
    let totalWritten = 0;

    while (true) {
      // Read the next chunk
      const { done, value } = await reader.read();
      if (done) break;

      // Write the chunk directly to disk
      await writable.write(value);

      totalWritten += value.length;
      setProgress(Math.round((totalWritten / chunkSize) * 100));
    }

    // Close the writable stream to finalize the file
    await writable.close();
    setStatus("File downloaded successfully!");
  } catch (error) {
    console.error("Error downloading file:", error);
    setStatus("Error during file download.");
  }
};
