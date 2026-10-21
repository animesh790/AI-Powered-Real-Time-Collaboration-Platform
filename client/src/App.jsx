
import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";
import { io } from "socket.io-client";

const API = "http://127.0.0.1:5000/api";

function App() {
  const [page, setPage] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [description, setDescription] = useState("");
  
const [inviteEmails, setInviteEmails] = useState({});
const [inviteMessages, setInviteMessages] = useState({});

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
const [chatMessages, setChatMessages] = useState([]);
const [chatText, setChatText] = useState("");
const [chatError, setChatError] = useState("");
const [chatSocket, setChatSocket] = useState(null);
const [documentSocket, setDocumentSocket] = useState(null);

const [sharedFiles, setSharedFiles] = useState([]);
const [selectedFile, setSelectedFile] = useState(null);
const [fileMessage, setFileMessage] = useState("");
const [fileLoading, setFileLoading] = useState(false);

const [documents, setDocuments] = useState([]);
const [activeDocument, setActiveDocument] = useState(null);
const [documentTitle, setDocumentTitle] = useState("");
const [documentContent, setDocumentContent] = useState("");



  const headers = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  const loadWorkspaces = async (authToken = token) => {
    try {
      const response = await axios.get(`${API}/workspaces`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setWorkspaces(response.data.workspaces);
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Could not load workspaces."
      );
    }
  };

  useEffect(() => {
    if (token) {
      loadWorkspaces(token);
    }
  }, [token]);

  const handleAuth = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const endpoint =
        page === "register" ? "/auth/register" : "/auth/login";

      const payload =
        page === "register"
          ? { name, email, password }
          : { email, password };

      const response = await axios.post(`${API}${endpoint}`, payload);

      setToken(response.data.token || "");
      setUser(response.data.user);
      setMessage(response.data.message || "Success!");

      if (page === "register") {
        setMessage("Account created. Please log in.");
        setPage("login");
        setPassword("");
      } else {
        setPage("dashboard");
      }
    } catch (error) {
  console.error("Login error:", error);

  setMessage(
    error.response
      ? `Error ${error.response.status}: ${
          error.response.data?.message || "Request failed"
        }`
      : `Connection error: ${error.message}`
  );
} finally {
      setLoading(false);
    }
  };

  
const createWorkspace = async (event) => {
  event.preventDefault();
  setMessage("");

  try {
    await axios.post(
      `${API}/workspaces`,
      { name: workspaceName, description },
      { headers }
    );

    setWorkspaceName("");
    setDescription("");
    setMessage("Workspace created successfully.");
    await loadWorkspaces();
  } catch (error) {
    setMessage(
      error.response?.data?.message || "Could not create workspace."
    );
  }
};

const inviteMember = async (workspaceId) => {
  const email = (inviteEmails[workspaceId] || "").trim();

  if (!email) {
    setInviteMessages((previous) => ({
      ...previous,
      [workspaceId]: "Please enter an email address.",
    }));
    return;
  }

  try {
    const response = await axios.post(
      `${API}/workspaces/${workspaceId}/members`,
      { email },
      { headers }
    );

    setInviteMessages((previous) => ({
      ...previous,
      [workspaceId]: response.data.message,
    }));

    setInviteEmails((previous) => ({
      ...previous,
      [workspaceId]: "",
    }));

    await loadWorkspaces();
  } catch (error) {
    setInviteMessages((previous) => ({
      ...previous,
      [workspaceId]:
        error.response?.data?.message || "Could not invite this user.",
    }));
  }
};


  const logout = () => {
    setToken("");
    setUser(null);
    setWorkspaces([]);
    setPassword("");
    setPage("login");
    setMessage("You have logged out.");
  };
  const openWorkspaceChat = (workspace) => {
  if (chatSocket) {
    chatSocket.disconnect();
  }

  setChatMessages([]);
  setChatError("");
  setChatText("");
  setActiveWorkspace(workspace);
  setDocuments([]);
setActiveDocument(null);
setDocumentTitle("");
setDocumentContent("");
loadDocuments(workspace._id);
  setSharedFiles([]);
setFileMessage("");
loadSharedFiles(workspace._id);

  const socket = io("http://127.0.0.1:5000", {
    auth: { token },
  });

  socket.on("connect", () => {
    socket.emit(
      "join-workspace",
      workspace._id,
      (response) => {
        if (response?.success) {
          setChatMessages(response.messages || []);
          setChatError("");
        } else {
          setChatError(response?.message || "Could not join workspace.");
        }
      }
    );
  });

  socket.on("new-message", (message) => {
    setChatMessages((previous) => [...previous, message]);
  });

  socket.on("connect_error", (error) => {
    setChatError(error.message || "Could not connect to chat.");
  });

  setChatSocket(socket);
};

const sendChatMessage = (event) => {
  event.preventDefault();

  const text = chatText.trim();

  if (!text || !chatSocket || !activeWorkspace) {
    return;
  }

  chatSocket.emit(
    "send-message",
    {
      workspaceId: activeWorkspace._id,
      text,
    },
    (response) => {
      if (response?.success) {
        setChatText("");
        setChatError("");
      } else {
        setChatError(
          response?.message || "Could not send message."
        );
      }
    }
  );
};

const loadDocuments = async (workspaceId) => {
  try {
    const response = await axios.get(
      `${API}/documents/workspace/${workspaceId}`,
      { headers }
    );

    setDocuments(response.data.documents || []);
  } catch (error) {
    console.error("Load documents error:", error);
    setMessage("Could not load documents.");
  }
};

const createDocument = async () => {
  if (!activeWorkspace) {
    setMessage("Please open a workspace first.");
    return;
  }

  const title = window.prompt("Enter a document title:");

  if (!title || !title.trim()) {
    return;
  }

  try {
    const response = await axios.post(
      `${API}/documents/${activeWorkspace._id}`,
      { title: title.trim() },
      { headers }
    );

    setMessage("Document created successfully.");
    await loadDocuments(activeWorkspace._id);
    setActiveDocument(response.data.document);
    setDocumentTitle(response.data.document.title);
    setDocumentContent(response.data.document.content || "");
  } catch (error) {
    console.error("Create document error:", error);
    setMessage(
      error.response?.data?.message || "Could not create document."
    );
  }
};


const openDocument = (document) => {
  if (documentSocket) {
    documentSocket.disconnect();
    setDocumentSocket(null);
  }

  setActiveDocument(document);
  setDocumentTitle(document.title);
  setDocumentContent(document.content || "");
  setMessage("");

  const socket = io("http://127.0.0.1:5000", {
    auth: { token },
  });

  socket.on("connect", () => {
    socket.emit("join-document", document._id, (response) => {
      if (response?.success) {
        setActiveDocument(response.document);
        setDocumentTitle(response.document.title);
        setDocumentContent(response.document.content || "");
      } else {
        setMessage(response?.message || "Could not open document.");
      }
    });
  });

  socket.on("document-changed", (data) => {
    if (data.documentId === document._id) {
      setDocumentContent(data.content);
    }
  });

  socket.on("connect_error", () => {
    setMessage("Could not connect to the document editor.");
  });

  setDocumentSocket(socket);
};



const saveDocument = (content) => {
  console.log("saveDocument called", {
  hasDocument: !!activeDocument,
  hasSocket: !!documentSocket,
  contentLength: content.length,
});
  if (!activeDocument || !documentSocket) return;
  console.log("Document socket connected:", documentSocket.connected);

  documentSocket.emit(
    "document-update",
    {
      documentId: activeDocument._id,
      content,
    },
    (response) => {
      console.log("Document save response:", response);
      if (!response?.success) {
        setMessage(
          response?.message || "Could not save document changes."
        );
      } else {
        setMessage("Document saved successfully.");
      }
    }
  );
};




const loadSharedFiles = async (workspaceId) => {
  try {
    const response = await axios.get(
      `${API}/files/${workspaceId}`,
      { headers }
    );

    setSharedFiles(response.data.files);
    setFileMessage("");
  } catch (error) {
    setFileMessage(
      error.response?.data?.message ||
        "Could not load shared files."
    );
  }
};

const uploadSharedFile = async (event) => {
  event.preventDefault();

  if (!activeWorkspace || !selectedFile) {
    setFileMessage("Please select a file first.");
    return;
  }

  if (selectedFile.size > 10 * 1024 * 1024) {
    setFileMessage("File size must not exceed 10 MB.");
    return;
  }

  const formData = new FormData();
  formData.append("file", selectedFile);

  setFileLoading(true);
  setFileMessage("");

  try {
    const response = await axios.post(
      `${API}/files/${activeWorkspace._id}`,
      formData,
      { headers }
    );

    setFileMessage(response.data.message);
    setSelectedFile(null);
    event.target.reset();

    await loadSharedFiles(activeWorkspace._id);
  } catch (error) {
    setFileMessage(
      error.response?.data?.message || "File upload failed."
    );
  } finally {
    setFileLoading(false);
  }
};

const downloadSharedFile = async (file) => {
  try {
    const response = await axios.get(
      `${API}/files/download/${file._id}`,
      {
        headers,
        responseType: "blob",
      }
    );

    const url = window.URL.createObjectURL(response.data);
    const link = document.createElement("a");

    link.href = url;
    link.download = file.originalName;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.URL.revokeObjectURL(url);
  } catch (error) {
    setFileMessage("Could not download the file.");
  }
};


  if (page === "dashboard" && token) {
    return (
      <main className="app-shell">
        <header className="topbar">
          <div>
            <h1>CollabSpace</h1>
            <p>AI-Powered Real-Time Collaboration Platform</p>
          </div>
          <button className="secondary-button" onClick={logout}>
            Log out
          </button>
        </header>

        <section className="welcome-panel">
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h2>Welcome, {user?.name || "Collaborator"}!</h2>
          <p>Bring your team, conversations, and projects together.</p>
        </section>

        {message && <p className="notice">{message}</p>}

        <section className="workspace-layout">
          <div className="panel">
            <h2>Create a workspace</h2>
            <p className="muted">
              Start a space for your team or project.
            </p>

            <form onSubmit={createWorkspace} className="form">
              <label htmlFor="workspaceName">Workspace name</label>
              <input
                id="workspaceName"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                placeholder="e.g. Final Year Project"
                required
              />

              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What will your team work on?"
                rows="3"
              />

              <button className="primary-button" type="submit">
                + Create workspace
              </button>
            </form>
          </div>

          <div className="panel">
            <div className="section-heading">
              <div>
                <h2>Your workspaces</h2>
                <p className="muted">
                  {workspaces.length} workspace
                  {workspaces.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={() => loadWorkspaces()}
              >
                Refresh
              </button>
            </div>

            {workspaces.length === 0 ? (
              <div className="empty-state">
                <h3>No workspaces yet</h3>
                <p>Create your first workspace to get started.</p>
              </div>
            ) : (
              <div className="workspace-list">
                {workspaces.map((workspace) => (
                  
                  <article className="workspace-card" key={workspace._id}>
                    <div className="workspace-icon">
                      {workspace.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3>{workspace.name}</h3>
                      <p>{workspace.description || "No description added."}</p>
                      <small>
                        Created{" "}
                        {new Date(workspace.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                    
<div className="invite-form">
  <input
    type="email"
    placeholder="Enter registered user's email"
    value={inviteEmails[workspace._id] || ""}
    onChange={(event) =>
      setInviteEmails((previous) => ({
        ...previous,
        [workspace._id]: event.target.value,
      }))
    }
  />

  



<button
  type="button"
  className="primary-button"
  onClick={() => inviteMember(workspace._id)}
>
  Invite Member
</button>


  {inviteMessages[workspace._id] && (
    <p className="notice">
      {inviteMessages[workspace._id]}
    </p>
  )}
</div>

                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
        
<section className="panel chat-panel">
  <div className="section-heading">
    <div>
      <h2>Workspace Chat</h2>
      <p className="muted">
        {activeWorkspace
          ? `Chatting in ${activeWorkspace.name}`
          : "Select a workspace below to start chatting."}
      </p>
    </div>
  </div>

  {!activeWorkspace ? (
    <div className="workspace-list">
      {workspaces.map((workspace) => (
        <button
          className="workspace-card chat-select"
          key={workspace._id}
          onClick={() => openWorkspaceChat(workspace)}
        >
          <div className="workspace-icon">
            {workspace.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3>{workspace.name}</h3>
            <p>Open workspace chat</p>
          </div>
        </button>
      ))}
    </div>
  ) : (
    <>
      <button
        className="secondary-button"
        onClick={() => {
          if (chatSocket) chatSocket.disconnect();
          setChatSocket(null);
          setActiveWorkspace(null);
          setChatMessages([]);
          setChatError("");
        }}
      >
        Back to workspaces
      </button>

      <div className="chat-messages">
        {chatMessages.map((message) => (
          <div className="chat-message" key={message._id}>
            <strong>{message.sender?.name || "User"}</strong>
            <p>{message.text}</p>
            <small>
              {message.createdAt
                ? new Date(message.createdAt).toLocaleTimeString()
                : ""}
            </small>
          </div>
        ))}
        {chatMessages.length === 0 && (
          <p className="muted">No messages yet. Start the conversation!</p>
        )}
      </div>

      <form className="chat-form" onSubmit={sendChatMessage}>
        <input
          value={chatText}
          onChange={(event) => setChatText(event.target.value)}
          placeholder="Write a message..."
          maxLength={2000}
          required
        />
        <button className="primary-button" type="submit">
          Send
        </button>
      </form>

      {chatError && <p className="notice">{chatError}</p>}
      
<section className="file-sharing">
  <h2>Shared Files</h2>
  <p className="muted">
    Upload and download files shared with this workspace.
    Maximum file size: 10 MB.
  </p>

  <form
    className="chat-form"
    onSubmit={uploadSharedFile}
  >
    <input
      type="file"
      onChange={(event) => {
        setSelectedFile(event.target.files?.[0] || null);
        setFileMessage("");
      }}
      required
    />

    <button
      className="primary-button"
      type="submit"
      disabled={fileLoading}
    >
      {fileLoading ? "Uploading..." : "Upload File"}
    </button>
  </form>

  {fileMessage && (
    <p className="notice">{fileMessage}</p>
  )}

  <button
    type="button"
    className="secondary-button"
    onClick={() => loadSharedFiles(activeWorkspace._id)}
  >
    Refresh Files
  </button>

  <div className="shared-file-list">
    {sharedFiles.map((file) => (
      <article className="shared-file-item" key={file._id}>
        <div>
          <strong>{file.originalName}</strong>
          <p className="muted">
            Uploaded by {file.uploadedBy?.name || "User"} ·{" "}
            {(file.size / 1024).toFixed(1)} KB
          </p>
          <small>
            {new Date(file.createdAt).toLocaleString()}
          </small>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => downloadSharedFile(file)}
        >
          Download
        </button>
      </article>
    ))}

    {sharedFiles.length === 0 && (
      <p className="muted">
        No files shared yet. Upload your first file.
      </p>
    )}
  </div>
</section>

<section className="file-sharing">
  <h2>Live Documents</h2>
  <p className="muted">
    Create and edit documents with your workspace members.
  </p>

  <button
    type="button"
    className="primary-button"
    onClick={createDocument}
  >
    + Create Document
  </button>

  <button
    type="button"
    className="secondary-button"
    onClick={() => loadDocuments(activeWorkspace._id)}
  >
    Refresh Documents
  </button>

  <div className="shared-file-list">
    {documents.map((document) => (
      <article className="shared-file-item" key={document._id}>
        <div>
          <strong>{document.title}</strong>
          <p className="muted">
            Last updated: {new Date(document.updatedAt).toLocaleString()}
          </p>
        </div>

        <button
          type="button"
          className="secondary-button"
          onClick={() => openDocument(document)}
        >
          Open
        </button>
      </article>
    ))}

    {documents.length === 0 && (
      <p className="muted">
        No documents yet. Create your first document.
      </p>
    )}
  </div>

  {activeDocument && (
    <div className="document-editor">
      <h3>Editing Document</h3>

      <label htmlFor="document-title">Document title</label>
      <input
        id="document-title"
        type="text"
        value={documentTitle}
        onChange={(event) => setDocumentTitle(event.target.value)}
        maxLength={150}
      />

      <label htmlFor="document-content">Document content</label>
      <textarea
        id="document-content"
        value={documentContent}
        onChange={(event) => {
          const content = event.target.value;
          setDocumentContent(content);
          saveDocument(content);
        }}
        rows={12}
        maxLength={500000}
        placeholder="Start writing your document..."
      />
    </div>
  )}
</section>


    </>
  )}
</section>


        <footer className="footer">
          Built for better teamwork · CollabSpace
        </footer>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <section className="brand-panel">
        <div className="brand-mark">C</div>
        <span className="eyebrow">WORK BETTER TOGETHER</span>
        <h1>One space.<br />Every idea.</h1>
        <p>
          Bring your projects and teammates together in one simple
          collaboration workspace.
        </p>

        <div className="feature-list">
          <div><span>01</span> Shared project workspaces</div>
          <div><span>02</span> Secure account access</div>
          <div><span>03</span> A foundation for real-time teamwork</div>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">WELCOME TO COLLABSPACE</span>
          <h2>{page === "register" ? "Create your account" : "Welcome back"}</h2>
          <p className="muted">
            {page === "register"
              ? "Create an account to start collaborating."
              : "Log in to continue to your workspace."}
          </p>

          {message && <p className="notice">{message}</p>}

          <form onSubmit={handleAuth} className="form">
            {page === "register" && (
              <>
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </>
            )}

            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
              minLength="6"
              required
            />

            <button className="primary-button" type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : page === "register"
                  ? "Create account"
                  : "Log in"}
            </button>
          </form>

          <p className="switch-text">
            {page === "register"
              ? "Already have an account?"
              : "New to CollabSpace?"}{" "}
            <button
              className="text-button"
              onClick={() => {
                setPage(page === "register" ? "login" : "register");
                setMessage("");
              }}
            >
              {page === "register" ? "Log in" : "Create an account"}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;
