import { useState } from "react";
import { useRouter } from "next/router";
import type { FileInfo } from "../types";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File size must be less than 5MB");
      return;
    }

    const fileExt = selectedFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "doc", "docx"].includes(fileExt!)) {
      setError("Only PDF and DOC files are allowed");
      return;
    }

    setFile(selectedFile);
    setError("");
  };

  const handleUpload = async () => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file: e.target?.result,
            fileName: file.name,
          }),
        });

        const data: FileInfo = await response.json();
        router.push(`/file/${data.id}`);
      } catch (error: any) {
        setError("Error uploading file");
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">File Sharing App</h1>

        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx"
            className="mb-4"
          />
          {error && <p className="text-red-500 mb-4">{error}</p>}
          <button
            onClick={handleUpload}
            disabled={!file || !!error}
            className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Upload File
          </button>
        </div>
      </div>
    </div>
  );
}
