"use client";

import { useState } from "react";

const CATEGORIES = [
  {
    name: "Smileys",
    icon: "😀",
    emojis: [
      "😀","😃","😄","😁","😆","😅","😂","🤣","🙂","🙃","😉","😊",
      "😇","🥰","😍","🤩","😘","😗","😚","😙","😋","😛","😜","🤪",
      "😝","🤗","🤭","🤫","🤔","😐","😑","😏","😒","🙄","😬","😴",
      "😷","🤒","🤕","🤢","🥵","🥶","😵","🤯","🤠","🥳","😎","🤓",
      "😕","😖","😢","😭","😤","😠","😡","🤬","😱","😨","🥺","🤧",
    ],
  },
  {
    name: "Gestures",
    icon: "👍",
    emojis: [
      "👋","🤚","✋","🖖","👌","🤌","🤏","✌️","🤞","🤟","🤘","🤙",
      "👈","👉","👆","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏",
      "🙌","👐","🤲","🤝","🙏","💪","🦾","✍️","💅","👀","🧠","🦷",
    ],
  },
  {
    name: "Hearts",
    icon: "❤️",
    emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕",
      "💞","💓","💗","💖","💘","💝","💟","💌","💋","😻","💐","🌹",
    ],
  },
  {
    name: "Animals",
    icon: "🐻",
    emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮",
      "🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🐤","🦆","🦅",
      "🦉","🦇","🐺","🐗","🐴","🦄","🐝","🦋","🐢","🐍","🐙","🦈",
    ],
  },
  {
    name: "Food",
    icon: "🍔",
    emojis: [
      "🍎","🍐","🍊","🍋","🍌","🍉","🍇","🍓","🫐","🍒","🍑","🥭",
      "🍍","🥥","🥝","🍅","🥑","🍆","🥔","🥕","🌽","🌶️","🥒","🥬",
      "🍄","🥜","🍞","🍔","🍟","🍕","🌭","🌮","🌯","🥗","🍝","🍜",
      "🍣","🍩","🍪","🎂","🍰","🧁","🍫","🍿","☕","🍵","🧋","🍺",
    ],
  },
  {
    name: "Activities",
    icon: "⚽",
    emojis: [
      "⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥅","🎯",
      "🎮","🎲","🎸","🎹","🎤","🎧","🎬","🎨","🏆","🥇","🎉","🎊",
      "🚴","🏊","🏖️","🎡","🎢","🎭","🎪","🎰",
    ],
  },
  {
    name: "Objects",
    icon: "💡",
    emojis: [
      "💻","🖥️","📱","⌚","💡","🔔","📷","🔑","💰","💎","🎁","🔥",
      "⭐","🌟","✨","⚡","☀️","🌙","🌈","☁️","❄️","💧","🌊","✅",
      "❌","❓","❗","⏰","💤","💯","✔️","➕","➖","⚠️","🚫","🔴",
      "🟢","🟡","🔵","🏠","🚗","✈️","🚀","🌍","📌","📎","📚","📝",
    ],
  },
];

export default function EmojiPicker({ onSelect }) {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <div className="absolute bottom-[calc(100%+12px)] left-0 z-20 w-[320px] max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-lg border border-solid border-gray-100 overflow-hidden animate-fadeIn">
      <div className="flex items-center gap-[2px] p-[8px_12px] border-b border-solid border-gray-100">
        {CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            type="button"
            title={cat.name}
            onClick={() => setActiveCategory(i)}
            className={`text-lg leading-none p-[6px] rounded-lg cursor-pointer transition-colors ${
              activeCategory === i
                ? "bg-gray-100 scale-110"
                : "opacity-60 hover:bg-gray-50"
            }`}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      <div className="p-[8px] h-[240px] overflow-y-auto [scrollbar-width:thin]">
        <div className="grid grid-cols-8">
          {CATEGORIES[activeCategory].emojis.map((emoji, i) => (
            <button
              key={`${emoji}-${i}`}
              type="button"
              onClick={() => onSelect(emoji)}
              className="text-xl leading-none p-[4px] rounded-lg cursor-pointer hover:bg-gray-100 transition-colors grid place-items-center"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
