import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import type { FileInfo } from "../types";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const getFileSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    else if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    const droppedFile = e.dataTransfer.files[0];
    handleFileValidation(droppedFile);
  }, []);

  const handleFileValidation = (selectedFile: File | null) => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileValidation(e.target.files?.[0] || null);
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setIsUploading(true);
    setError("");
    
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 500);

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

        if (!response.ok) throw new Error("Upload failed");

        clearInterval(progressInterval);
        setUploadProgress(100);
        
        const data: FileInfo = await response.json();
        setTimeout(() => {
          router.push(`/file/${data.id}`);
        }, 800);
      } catch (error: unknown) {
        setError("Error uploading file. Please try again.");
        setIsUploading(false);
        setUploadProgress(0);
        clearInterval(progressInterval);
      }
    };

    reader.readAsDataURL(file);
  };

  const dropZoneStyle = {
    border: `2px dashed ${isDragActive ? '#3b82f6' : '#e5e7eb'}`,
    backgroundColor: isDragActive ? '#f8fafc' : '#ffffff',
    borderRadius: '0.75rem',
    padding: '2rem',
    textAlign: 'center' as const,
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    position: 'relative' as const
  };

  return (
    <div style={{
      minHeight: "100vh",
      padding: "2rem",
      backgroundColor: "#f3f4f6"
    }}>
      <div style={{
        maxWidth: "42rem",
        margin: "0 auto"
      }}>
        <div style={{
          backgroundColor: "white",
          borderRadius: "1rem",
          padding: "2rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
        }}>
          <h1 style={{
            fontSize: "1.875rem",
            fontWeight: "bold",
            marginBottom: "0.5rem",
            color: "#1f2937"
          }}>
            File Upload
          </h1>
          <p style={{
            color: "#6b7280",
            marginBottom: "2rem"
          }}>
            Upload your documents securely. Supported formats: PDF, DOC, DOCX (Max 5MB)
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={dropZoneStyle}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx"
              style={{ display: "none" }}
            />
            
            {!file && (
              <div>
                <div style={{
                  fontSize: "3rem",
                  marginBottom: "1rem"
                }}>
                  📄
                </div>
                <p style={{
                  fontSize: "1.125rem",
                  fontWeight: "500",
                  color: "#374151",
                  marginBottom: "0.5rem"
                }}>
                  {isDragActive ? "Drop your file here" : "Drag & drop your file here"}
                </p>
                <p style={{
                  color: "#6b7280",
                  marginBottom: "1rem"
                }}>
                  - or -
                </p>
                <button style={{
                  backgroundColor: "#3b82f6",
                  color: "white",
                  padding: "0.75rem 2rem",
                  borderRadius: "0.5rem",
                  fontWeight: "500",
                  transition: "all 0.3s ease",
                  cursor: "pointer"
                }}>
                  Browse Files
                </button>
              </div>
            )}

            {file && !isUploading && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "1rem",
                backgroundColor: "#f3f4f6",
                borderRadius: "0.5rem",
                marginBottom: "1rem"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem"
                }}>
                  <span style={{
                    fontSize: "1.5rem"
                  }}>
                    📄
                  </span>
                  <div>
                    <p style={{
                      fontWeight: "500",
                      color: "#374151",
                      textAlign: "left"
                    }}>
                      {file.name}
                    </p>
                    <p style={{
                      color: "#6b7280",
                      fontSize: "0.875rem",
                      textAlign: "left"
                    }}>
                      {getFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  style={{
                    backgroundColor: "#fee2e2",
                    color: "#dc2626",
                    padding: "0.5rem",
                    borderRadius: "0.375rem",
                    cursor: "pointer",
                    transition: "all 0.3s ease"
                  }}
                >
                  ❌
                </button>
              </div>
            )}

            {isUploading && (
              <div style={{
                width: "100%"
              }}>
                <div style={{
                  height: "0.5rem",
                  backgroundColor: "#e5e7eb",
                  borderRadius: "0.25rem",
                  overflow: "hidden",
                  marginBottom: "1rem"
                }}>
                  <div style={{
                    height: "100%",
                    width: `${uploadProgress}%`,
                    backgroundColor: "#3b82f6",
                    transition: "width 0.5s ease",
                    borderRadius: "0.25rem"
                  }} />
                </div>
                <p style={{
                  color: "#6b7280"
                }}>
                  {uploadProgress === 100 ? "✅ Upload complete!" : `📤 Uploading... ${uploadProgress}%`}
                </p>
              </div>
            )}
          </div>

          {error && (
            <div style={{
              backgroundColor: "#fee2e2",
              color: "#dc2626",
              padding: "1rem",
              borderRadius: "0.5rem",
              marginTop: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}>
              ⚠️ {error}
            </div>
          )}

          <div style={{
            marginTop: "2rem",
            display: "flex",
            justifyContent: "flex-end",
            gap: "1rem"
          }}>
            <button
              onClick={() => setFile(null)}
              disabled={!file || isUploading}
              style={{
                backgroundColor: "#f3f4f6",
                color: "#374151",
                padding: "0.75rem 2rem",
                borderRadius: "0.5rem",
                fontWeight: "500",
                cursor: !file || isUploading ? "not-allowed" : "pointer",
                opacity: !file || isUploading ? "0.5" : "1",
                transition: "all 0.3s ease"
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || !!error || isUploading}
              style={{
                backgroundColor: !file || !!error || isUploading ? "#93c5fd" : "#3b82f6",
                color: "white",
                padding: "0.75rem 2rem",
                borderRadius: "0.5rem",
                fontWeight: "500",
                cursor: !file || !!error || isUploading ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem"
              }}
            >
              {uploadProgress === 100 ? "✅ Uploaded!" : "📤 Upload File"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}