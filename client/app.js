// Define the server URL and token
const serverUrl = "http://localhost:3000";
const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwibmFtZSI6IkpvaG4iLCJpYXQiOjE3MzM3MzAxMjIsImV4cCI6MTczNDMzNDkyMn0.X_84MaxNu5SwAHChLo12tGIERzKj64IPQYvmscMH4S0";

// Establish the connection
const socket = io(serverUrl, {
  query: { token },
});

// Update the status on successful connection
socket.on("connect", () => {
  console.log("Connected to the server!");
  document.getElementById("status").innerText = "Connected!";
});

// Handle errors
socket.on("connect_error", (err) => {
  console.error("Connection error:", err);
  document.getElementById("status").innerText = "Connection failed!";
});

// Listen for messages
socket.on("ping", (callback) => {
  callback("pong");
});
