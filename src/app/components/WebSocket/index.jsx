"use client";

import { useEffect, useRef, useState } from "react";
import socket from "@/lib/socket";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

export default function WebSocket() {
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(false);

  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const handleInput = (e) => {
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
    setMessage(e.target.value);
  };

  console.log("message", messages);

  // ✅ Listen for messages from backend
  useEffect(() => {
    socket.on("receiveMessage", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("serverMessage", (msg) => {
      setMessages((prev) => [...prev, { user: "Server", text: msg }]);
    });

    return () => {
      socket.off("receiveMessage");
      socket.off("serverMessage");
    };
  }, []);

  useEffect(() => {
    joined ? setOpen(false) : setOpen(true);
  }, [joined]);

  console.log("joined", joined);

  // ✅ Join chat
  const joinChat = () => {
    if (username.trim() === "") {
      setError(true);
    } else {
      socket.emit("join", username);
      setJoined(true);
      setError(true);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ✅ Send message
  const sendMessage = () => {
    if (message.trim() === "") return;

    socket.emit("chatMessage", message);
    setMessage("");
  };

  return (
    <>
      <header className="p-[8px_16px] md:p-[8px_40px] bg-white border-b border-solid border-gray-100 h-[48px]">
        <a
          href=""
          className="font-bold flex items-start gap-[4px] text-md leading-none "
        >
          <span className="p-[2px_4px] bg-gray-50 rounded self-end">
            {" "}
            Vchat
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="size-6"
          >
            <path
              fillRule="evenodd"
              d="M12 2.25c-2.429 0-4.817.178-7.152.521C2.87 3.061 1.5 4.795 1.5 6.741v6.018c0 1.946 1.37 3.68 3.348 3.97.877.129 1.761.234 2.652.316V21a.75.75 0 0 0 1.28.53l4.184-4.183a.39.39 0 0 1 .266-.112c2.006-.05 3.982-.22 5.922-.506 1.978-.29 3.348-2.023 3.348-3.97V6.741c0-1.947-1.37-3.68-3.348-3.97A49.145 49.145 0 0 0 12 2.25ZM8.25 8.625a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Zm2.625 1.125a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z"
              clipRule="evenodd"
            />
          </svg>
        </a>
      </header>

      {/* Chat messages */}
      <div className="bg-[url('/img/chat-bg.png')] bg-amber-50/10  bg-repeat bg-[length:200px]  flex flex-col">
        <div className="w-full flex flex-col grow relative">
          <div className="grow h-[calc(100dvh-150px)] rounded p-[16px_16px_80px_16px] md:p-[16px_40px_80px_40px] [scrollbar-width:thin] overflow-auto">
            {messages.map((msg, index) => {
              console.log(
                "msg.id === socket.id",
                msg.id === socket.id,
                msg.id,
                socket.id,
              );
              const isMe = msg.id === socket.id;

              // ✅ Server/System message
              if (msg.user === "Server") {
                return (
                  <p key={index} className="text-center text-xs italic text-gray-500 bg-gray-100 px-3 py-1 rounded w-fit mx-auto animate-fadeIn my-[16px]">
                    {msg.text}
                  </p>
                );
              }

              // ✅ Normal chat message
              return (
                <div
                  key={index}
                  className={`flex items-start gap-[6px] max-w-[50%]  ${
                    isMe
                      ? "ms-auto flex-row-reverse mb-[4px]"
                      : "me-auto mb-[16px]"
                  }`}
                >
                  {/* Avatar */}
                  <span
                    className={`w-[24px] h-[24px] min-w-[24px] text-xs leading-none font-bold text-white bg-gray-700 grid place-items-center rounded-full ${isMe ? "hidden" : "block"}`}
                  >
                    {msg.user?.charAt(0).toUpperCase()}
                  </span>

                  {/* Message Bubble */}
                  <div
                    className={`p-[4px_16px] text-sm ${
                      isMe
                        ? "bg-green-200 rounded-[8px_0_8px_8px]"
                        : "bg-yellow-50 rounded-[0px_8px_8px_8px]"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-[16px] w-full ">
            <div
              className="mx-auto shadow-sm rounded-4xl
             flex items-center gap-[8px] bg-white w-full md:max-w-[calc(100%-56px)] p-[4px_16px]"
            >
              <textarea
                ref={ref}
                rows={1}
                placeholder="Type a message..."
                value={message}
                onKeyDown={handleKeyDown}
                onChange={handleInput}
                className={`px-[16px] min-h-[40px] max-h-[100px] resize-none outline-none overflow-auto 
  [scrollbar-width:thin] block w-full text-sm py-[10px] 
  ${!message ? "!h-[40px]" : "leading-normal"}`}
              />

              <button
                onClick={sendMessage}
                disabled={!message.trim()}
                className={`p-[10px] hover:bg-gray-200 bg-gray-100 cursor-pointer rounded-full  grid place-items-center
  ${!message.trim() ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-6"
                >
                  <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onClose={setOpen} className="relative z-10">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-500/75 transition-opacity data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in"
        />

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <DialogPanel
              transition
              className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all data-closed:translate-y-4 data-closed:opacity-0 data-enter:duration-300 data-enter:ease-out data-leave:duration-200 data-leave:ease-in sm:my-8 w-full sm:max-w-lg data-closed:sm:translate-y-0 data-closed:sm:scale-95"
            >
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 w-full text-center sm:mt-0 sm:text-left">
                    <DialogTitle
                      as="h3"
                      className="text-base font-semibold text-gray-900"
                    >
                      Join Chat
                    </DialogTitle>
                    <div className="mt-2">
                      <input
                        placeholder="Enter your name..."
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={` ${(error && !username) ? "border-red-300" : "border-gray-100 "} border border-solid w-full block rounded h-[40px] outline-none px-[16px] text-sm`}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className=" bg-[url('/img/chat-bg.png')] bg-amber-50/10  bg-repeat bg-[length:200px]  px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-solid border-gray-100">
                <button
                  type="button"
                  data-autofocus
                  onClick={() => joinChat()}
                  className={`mt-3 outline-none hover:text-white hover:bg-gray-950 inline-flex w-full justify-center cursor-pointer rounded-md bg-white px-[32px] py-2 text-sm font-medium text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:inset-ring-gray-950 transition-all duration-200 sm:mt-0 sm:w-auto ${username ? "opacity-100" : "opacity-80"} `}
                >
                  Join
                </button>
              </div>
            </DialogPanel>
          </div>
        </div>
      </Dialog>
    </>
  );
}
