"use client";

import { useEffect, useRef, useState } from "react";
import socket from "@/lib/socket";
import EmojiPicker from "@/app/components/EmojiPicker";
import GifPicker from "@/app/components/GifPicker";
import {
  registerServiceWorker,
  requestNotificationPermission,
  isNotificationEnabled,
  setNotificationEnabled,
  showNotification,
} from "@/lib/notifications";
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

const REACTION_PREFIX = "reaction:";
const REPLY_PREFIX = "reply:";
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const GIF_PREFIX = "gif:";

const isGifMessage = (text) =>
  typeof text === "string" && text.startsWith(GIF_PREFIX);

const getGifUrl = (text) => text.slice(GIF_PREFIX.length);

// Zero-width space — keeps the message id invisible if ever rendered raw
const MSG_ID_SEP = "\u200b";

const makeMsgId = () => Math.random().toString(36).slice(2, 10);

// Splits "text\u200bid" payloads coming from the backend
const parseIncoming = (raw) => {
  if (typeof raw !== "string") return { text: raw ?? "", msgId: null };

  const sep = raw.lastIndexOf(MSG_ID_SEP);
  if (sep > -1) {
    const maybeId = raw.slice(sep + 1);
    if (/^[a-z0-9]{6,12}$/i.test(maybeId)) {
      return { text: raw.slice(0, sep), msgId: maybeId };
    }
  }
  return { text: raw, msgId: null };
};

// Shortened preview of a quoted message for reply metadata / chips
const makeQuoteSnippet = (text) => {
  if (isGifMessage(text)) return "GIF";
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > 80 ? `${clean.slice(0, 77)}...` : clean;
};

// Builds "reply:<url-encoded-meta>:<reply text>" payloads
const buildReplyPayload = (replyMeta, text) =>
  `${REPLY_PREFIX}${encodeURIComponent(JSON.stringify(replyMeta))}:${text}`;

// Parses the meta portion back out of a reply payload
const parseReplyPayload = (text) => {
  const rest = text.slice(REPLY_PREFIX.length);
  const sepIdx = rest.indexOf(":");

  if (sepIdx === -1) return null;

  try {
    const meta = JSON.parse(decodeURIComponent(rest.slice(0, sepIdx)));
    if (!meta || !meta.t) return null;
    return {
      targetId: meta.t,
      quoteUser: meta.u || "",
      quoteSnippet: meta.s || "",
      text: rest.slice(sepIdx + 1),
    };
  } catch {
    return null;
  }
};

export default function WebSocket() {
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(false);

  const [open, setOpen] = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [notificationsOn, setNotificationsOn] = useState(false);
  const ref = useRef(null);
  const emojiWrapRef = useRef(null);
  const gifWrapRef = useRef(null);
  const notificationsRef = useRef(false);

  const [reactionFor, setReactionFor] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const handleInput = (e) => {
    ref.current.style.height = "auto";
    ref.current.style.height = ref.current.scrollHeight + "px";
    setMessage(e.target.value);
  };

  console.log("message", messages);

  // ✅ Listen for messages from backend
  useEffect(() => {
    registerServiceWorker().then(() => {
      const enabled = isNotificationEnabled();
      notificationsRef.current = enabled;
      setNotificationsOn(enabled);
    });

    socket.on("receiveMessage", (data) => {
      // ✅ Reaction updates — merge into the target message (by id) instead
      // of appending. Targets by id so every client stays in sync even when
      // their local message lists have different lengths/order.
      if (
        typeof data.text === "string" &&
        data.text.startsWith(REACTION_PREFIX)
      ) {
        const rest = data.text.slice(REACTION_PREFIX.length);
        const sepIdx = rest.indexOf(":");

        if (sepIdx > -1 && data.user) {
          const targetId = rest.slice(0, sepIdx);
          const emoji = rest.slice(sepIdx + 1);

          if (targetId && emoji) {
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.msgId !== targetId || msg.user === "Server") return msg;

                const reactions = { ...(msg.reactions || {}) };
                const users = reactions[emoji] ? [...reactions[emoji]] : [];
                const has = users.includes(data.user);

                if (has) {
                  users.splice(users.indexOf(data.user), 1);
                } else {
                  users.push(data.user);
                }

                if (users.length > 0) {
                  reactions[emoji] = users;
                } else {
                  delete reactions[emoji];
                }

                return { ...msg, reactions };
              }),
            );
          }
        }
        return;
      }

      const { text: rawText, msgId } = parseIncoming(data.text);

      let text = rawText;
      let replyTo = null;

      if (typeof rawText === "string" && rawText.startsWith(REPLY_PREFIX)) {
        const parsedReply = parseReplyPayload(rawText);
        if (parsedReply) {
          text = parsedReply.text;
          replyTo = {
            id: parsedReply.targetId,
            user: parsedReply.quoteUser,
            snippet: parsedReply.quoteSnippet,
          };
        }
      }

      setMessages((prev) => [
        ...prev,
        { ...data, text, msgId, replyTo, reactions: {} },
      ]);

      if (
        document.hidden &&
        data.user &&
        text &&
        data.id !== socket.id
      ) {
        showNotification(`New message from ${data.user}`, {
          body: isGifMessage(text)
            ? "Sent a GIF"
            : text,
        });
      }
    });

    socket.on("serverMessage", (msg) => {
      setMessages((prev) => [...prev, { user: "Server", text: msg }]);
    });

    return () => {
      socket.off("receiveMessage");
      socket.off("serverMessage");
    };
  }, []);

  // ✅ Close pickers on outside click / Escape
  useEffect(() => {
    if (!showEmoji && !showGif) return;

    const onPointerDown = (e) => {
      if (
        emojiWrapRef.current &&
        !emojiWrapRef.current.contains(e.target)
      ) {
        setShowEmoji(false);
      }
      if (
        gifWrapRef.current &&
        !gifWrapRef.current.contains(e.target)
      ) {
        setShowGif(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setShowEmoji(false);
        setShowGif(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showEmoji, showGif]);

  // ✅ Join chat
  const joinChat = () => {
    if (username.trim() === "") {
      setError(true);
    } else {
      socket.emit("join", username);
      setJoined(true);
      setOpen(false);
      setError(false);
    }
  };

  const handleUsernameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      joinChat();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape" && replyingTo) {
      setReplyingTo(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ✅ Begin replying to a message
  const startReply = (msg) => {
    if (!msg?.msgId || msg.user === "Server") return;
    setReplyingTo({
      msgId: msg.msgId,
      user: msg.user,
      snippet: makeQuoteSnippet(msg.text),
    });
    ref.current?.focus();
  };

  // ✅ Send reaction (toggle via broadcast, targeted by message id)
  const toggleReaction = (msg, emoji) => {
    if (!msg?.msgId) return;
    socket.emit("chatMessage", `${REACTION_PREFIX}${msg.msgId}:${emoji}`);
    setReactionFor(null);
  };

  // ✅ Close reaction tray on outside click / Escape
  useEffect(() => {
    if (reactionFor === null) return;

    const onPointerDown = (e) => {
      if (
        !(e.target instanceof Element) ||
        !e.target.closest("[data-reaction-popover]")
      ) {
        setReactionFor(null);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === "Escape") setReactionFor(null);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [reactionFor]);

  // ✅ Send message
  const sendMessage = () => {
    if (message.trim() === "") return;

    let payload = message;
    if (replyingTo?.msgId) {
      payload = buildReplyPayload(
        {
          t: replyingTo.msgId,
          u: replyingTo.user,
          s: replyingTo.snippet,
        },
        message,
      );
    }

    socket.emit("chatMessage", `${payload}${MSG_ID_SEP}${makeMsgId()}`);
    setMessage("");
    setReplyingTo(null);

    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = ref.current.scrollHeight + "px";
    }
  };

  // ✅ Send GIF
  const sendGif = (url) => {
    socket.emit(
      "chatMessage",
      `${GIF_PREFIX}${url}${MSG_ID_SEP}${makeMsgId()}`,
    );
    setShowGif(false);
    setReplyingTo(null);
  };

  // ✅ Insert emoji at cursor position
  const insertEmoji = (emoji) => {
    const el = ref.current;
    if (!el) {
      setMessage((m) => m + emoji);
      return;
    }

    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    setMessage(message.slice(0, start) + emoji + message.slice(end));

    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.style.height = "auto";
      el.style.height = el.scrollHeight + "px";
    });
  };

  // ✅ Toggle push notifications
  const toggleNotifications = async () => {
    if (notificationsOn) {
      setNotificationEnabled(false);
      setNotificationsOn(false);
      notificationsRef.current = false;
      return;
    }

    const permission = await requestNotificationPermission();
    if (permission === "granted") {
      setNotificationEnabled(true);
      setNotificationsOn(true);
      notificationsRef.current = true;
      showNotification("Push notifications enabled", {
        body: "You'll be notified when new messages arrive.",
        tag: "vchat-test",
      });
    }
  };

  return (
    <>
      <header className="p-[8px_16px] md:p-[8px_40px] bg-white border-b border-solid border-gray-100 h-[48px] flex items-center justify-between">
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
              d="M12 2.25c-2.429 0-4.817.178-7.152.521C2.87 3.061 1.5 4.795 1.5 6.741v6.018c0 1.946 1.37 3.68 3.348 3.97.877.129 1.761.234 2.652.316V21a.75.75 0 0 0 1.28.53l4.184-4.183a.39.39 0 0 1 .266-.112c2.006-.05 3.982-.22 5.922-.506 1.978-.29 3.348-2.023 3.348-3.97V6.741c0-1.947-1.37-3.68-3.348-3.97A49.145 49.145 0 0 0 12 2.25ZM8.25 8.625a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Zm2.625 1.125a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0 2.25Z"
              clipRule="evenodd"
            />
          </svg>
        </a>

        {/* Push notification toggle */}
        <button
          type="button"
          title={
            notificationsOn
              ? "Notifications on — click to mute"
              : "Enable push notifications"
          }
          onClick={toggleNotifications}
          className={`relative p-[6px] rounded-full cursor-pointer transition-colors ${
            notificationsOn
              ? "text-green-600 bg-green-50 hover:bg-green-100"
              : "text-gray-400 bg-gray-100 hover:bg-gray-200"
          }`}
        >
          {notificationsOn ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-5"
            >
              <path
                fillRule="evenodd"
                d="M5.25 9c0-3.728 3.022-6.75 6.75-6.75S18.75 5.272 18.75 9c0 2.152.282 4.184.78 5.997.11.4.17.79.186 1.168.04.944-.494 1.72-1.276 2.126-.153.079-.315.146-.485.201a35.99 35.99 0 0 1-2.09.083l-.013.006a3.75 3.75 0 0 1-6.955.013l-.012-.007a35.99 35.99 0 0 1-2.09-.083 3.86 3.86 0 0 1-.485-.2c-.782-.407-1.316-1.183-1.276-2.127.015-.377.075-.768.185-1.168A23.836 23.836 0 0 0 5.25 9Zm5.973 10.49a2.25 2.25 0 0 0 3.982 1.732 32.921 32.921 0 0 1-3.982-1.731Z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-5"
            >
              <path d="M3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18ZM20.57 16.334c.11.4.17.79.186 1.168L7.32 4.066A6.734 6.734 0 0 1 12 2.25c3.728 0 6.75 3.022 6.75 6.75 0 2.152.282 4.184.78 5.997.107.39.174.77.203 1.134l-.163-.297ZM4.184 14.997A23.836 23.836 0 0 0 5.25 9c0-.51.057-1.007.164-1.485l11.117 11.117a35.99 35.99 0 0 1-1.596.068l-.013.006a3.75 3.75 0 0 1-6.955.013l-.012-.007a35.99 35.99 0 0 1-2.09-.083 3.86 3.86 0 0 1-.485-.2c-.782-.407-1.316-1.183-1.276-2.127.015-.377.075-.768.185-1.168Zm4.039 5.493a2.25 2.25 0 0 0 3.982 1.732 32.921 32.921 0 0 1-3.982-1.731Z" />
            </svg>
          )}
          {notificationsOn && (
            <span className="absolute top-[2px] right-[2px] w-[8px] h-[8px] bg-green-500 rounded-full ring-2 ring-white" />
          )}
        </button>
      </header>

      {/* Chat messages */}
      <div className="bg-[url('/img/chat-bg.png')] bg-amber-50/10  bg-repeat bg-[length:200px]  flex flex-col h-[calc(100dvh-48px)]">
        <div className="w-full flex flex-col grow relative h-full">
          <div className="grow  rounded p-[16px_16px_80px_16px] md:p-[16px_40px_80px_40px] [scrollbar-width:thin] overflow-auto">
            {messages.map((msg, index) => {
              console.log(
                "msg.id === socket.id",
                msg.id === socket.id,
                msg.id,
                socket.id,
              );
              const isMe = msg.id === socket.id;
              const isGif = isGifMessage(msg.text);

              // ✅ Server/System message
              if (msg.user === "Server") {
                return (
                  <p key={index} className="text-center text-xs italic text-gray-500 bg-gray-100 px-3 py-1 rounded w-fit mx-auto animate-fadeIn my-[16px]">
                    {msg.text}
                  </p>
                );
              }

              // ✅ Normal chat message
              const reactions = msg.reactions || {};
              const hasReactions = Object.keys(reactions).length > 0;

              return (
                <div
                  key={index}
                  className={`relative flex items-start gap-[6px]  ${
                    isMe
                      ? `ms-auto flex-row-reverse mb-[4px] ${
                          isGif ? "max-w-[70%]" : "max-w-[50%]"
                        }`
                      : `me-auto mb-[16px] ${isGif ? "max-w-[70%]" : "max-w-[50%]"}`
                  }`}
                >
                  {/* Avatar */}
                  <span
                    className={`w-[24px] h-[24px] min-w-[24px] text-xs leading-none font-bold text-white bg-gray-700 grid place-items-center rounded-full ${isMe ? "hidden" : "block"}`}
                  >
                    {msg.user?.charAt(0).toUpperCase()}
                  </span>

                  <div className="flex flex-col min-w-0">
                    {/* Bubble + reaction trigger */}
                    <div className="flex items-center gap-[4px] group min-w-0">
                      {isGif ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getGifUrl(msg.text)}
                          alt="GIF"
                          className={`rounded-lg max-h-[220px] w-auto animate-fadeIn ${
                            isMe
                              ? "rounded-[8px_0_8px_8px]"
                              : "rounded-[0px_8px_8px_8px]"
                          }`}
                        />
                      ) : (
                        <div
                          className={`p-[4px_16px] text-sm break-words ${
                            isMe
                              ? "bg-green-200 rounded-[8px_0_8px_8px]"
                              : "bg-yellow-50 rounded-[0px_8px_8px_8px]"
                          }`}
                        >
                          {msg.replyTo && (
                            <div className="border-l-[3px] border-solid border-gray-400 pl-[8px] py-[2px] my-[4px] opacity-80">
                              <span className="block text-xs font-semibold text-gray-700 leading-snug">
                                {msg.replyTo.user}
                              </span>
                              <span className="block text-xs text-gray-600 truncate max-w-[240px]">
                                {msg.replyTo.snippet}
                              </span>
                            </div>
                          )}
                          {msg.text}
                        </div>
                      )}

                      {/* Reply trigger */}
                      <button
                        type="button"
                        title="Reply"
                        onClick={() => startReply(msg)}
                        className="shrink-0 p-[2px] rounded-full cursor-pointer text-gray-400 opacity-40 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-70 hover:!opacity-100 hover:bg-gray-100 transition-all"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-4"
                        >
                          <polyline points="9 14 4 9 9 4" />
                          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        data-reaction-popover
                        title="React"
                        onClick={() =>
                          setReactionFor(reactionFor === index ? null : index)
                        }
                        className="shrink-0 p-[2px] rounded-full cursor-pointer text-gray-400 opacity-40 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-70 hover:!opacity-100 hover:bg-gray-100 transition-all"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="size-4"
                        >
                          <circle cx="12" cy="12" r="9" />
                          <path d="M8.5 14.5s1.2 1.8 3.5 1.8 3.5-1.8 3.5-1.8" />
                          <line x1="9" y1="9.5" x2="9.01" y2="9.5" />
                          <line x1="15" y1="9.5" x2="15.01" y2="9.5" />
                        </svg>
                      </button>
                    </div>

                    {/* Reaction chips */}
                    {hasReactions && (
                      <div
                        className={`flex flex-wrap gap-[4px] mt-[4px] ${
                          isMe ? "justify-end" : ""
                        }`}
                      >
                        {Object.entries(reactions).map(([emoji, users]) => (
                          <button
                            key={emoji}
                            type="button"
                            title={users.join(", ")}
                            onClick={() => toggleReaction(msg, emoji)}
                            className={`text-xs leading-none px-[6px] py-[3px] rounded-full cursor-pointer border border-solid transition-colors ${
                              users.includes(username)
                                ? "bg-blue-50 border-blue-300"
                                : "bg-white border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            {emoji}
                            {users.length > 1 && ` ${users.length}`}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Reaction tray */}
                    {reactionFor === index && (
                      <div
                        data-reaction-popover
                        className={`absolute z-20 bottom-full mb-[6px] flex items-center gap-[2px] bg-white shadow-lg border border-solid border-gray-100 rounded-full p-[4px_8px] animate-fadeIn ${
                          isMe ? "right-6" : "left-6"
                        }`}
                      >
                        {QUICK_REACTIONS.map((emoji) => {
                          const mine = reactions[emoji]?.includes(username);
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => toggleReaction(msg, emoji)}
                              className={`text-lg leading-none p-[4px] rounded-full cursor-pointer transition-transform hover:scale-125 ${
                                mine ? "bg-blue-50 scale-110" : "hover:bg-gray-100"
                              }`}
                            >
                              {emoji}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-[16px] w-full max-w-[75%] mx-auto ">
            {/* Reply preview */}
            {replyingTo && (
              <div className="mx-auto mb-[6px] bg-white shadow-sm rounded-2xl px-[12px] py-[8px] flex items-center gap-[8px] w-full md:max-w-[calc(100%-56px)] animate-fadeIn">
                <div className="flex-1 min-w-0 border-l-[3px] border-solid border-gray-300 pl-[10px]">
                  <p className="text-xs font-semibold text-gray-700 leading-snug">
                    Replying to {replyingTo.user}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {replyingTo.snippet}
                  </p>
                </div>
                <button
                  type="button"
                  title="Cancel reply"
                  onClick={() => setReplyingTo(null)}
                  className="shrink-0 p-[4px] rounded-full cursor-pointer text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-4"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            )}

            <div
              className="mx-auto shadow-sm rounded-4xl
             flex items-center gap-[8px] bg-white w-full p-[4px_16px]"
            >
              {/* Emoji picker */}
              <div ref={emojiWrapRef} className="relative flex items-center">
                <button
                  type="button"
                  title="Emoji"
                  onClick={() => {
                    setShowEmoji((v) => !v);
                    setShowGif(false);
                  }}
                  className={`p-[6px] rounded-full cursor-pointer grid place-items-center transition-colors ${
                    showEmoji
                      ? "bg-yellow-100 text-yellow-600"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-500"
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="size-5"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M8.5 14.5s1.2 1.8 3.5 1.8 3.5-1.8 3.5-1.8" />
                    <line x1="9" y1="9.5" x2="9.01" y2="9.5" />
                    <line x1="15" y1="9.5" x2="15.01" y2="9.5" />
                  </svg>
                </button>

                {showEmoji && (
                  <EmojiPicker onSelect={insertEmoji} />
                )}
              </div>
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

              {/* GIF picker */}
              <div ref={gifWrapRef} className="relative flex items-center">
                <button
                  type="button"
                  title="GIF"
                  onClick={() => {
                    setShowGif((v) => !v);
                    setShowEmoji(false);
                  }}
                  className={`p-[6px] rounded-full cursor-pointer grid place-items-center text-[10px] font-extrabold tracking-tight transition-colors ${
                    showGif
                      ? "bg-purple-100 text-purple-600"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-500"
                  }`}
                >
                  GIF
                </button>

                {showGif && (
                  <GifPicker onSelect={sendGif} />
                )}
              </div>

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

      <Dialog
        open={open}
        onClose={(value) => {
          if (joined) setOpen(value);
        }}
        className="relative z-10"
      >
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
                        data-autofocus
                        placeholder="Enter your name..."
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        onKeyDown={handleUsernameKeyDown}
                        className={` ${(error && !username.trim()) ? "border-red-300" : "border-gray-100 "} border border-solid w-full block rounded h-[40px] outline-none px-[16px] text-sm`}
                      />
                      {error && !username.trim() && (
                        <p className="text-xs text-red-500 mt-[6px]">
                          Please enter your name to join
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className=" bg-[url('/img/chat-bg.png')] bg-amber-50/10  bg-repeat bg-[length:200px]  px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-solid border-gray-100">
                <button
                  type="button"
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
