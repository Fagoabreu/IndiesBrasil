import { useEffect, useRef, useState } from "react";
import style from "./TyperwriterComponent.module.css";

export default function TyperwriterComponent({ initText, frases = [] }) {
  const [text, setText] = useState("");
  const fraseIndex = useRef(0);
  const charIndex = useRef(0);
  const isDeleting = useRef(false);

  useEffect(() => {
    const currentFrase = frases[fraseIndex.current];

    const timeout = setTimeout(
      () => {
        if (isDeleting.current) {
          charIndex.current--;
          setText(currentFrase.substring(0, charIndex.current));
        } else {
          charIndex.current++;
          setText(currentFrase.substring(0, charIndex.current));
        }

        if (!isDeleting.current && charIndex.current === currentFrase.length) {
          isDeleting.current = true;
        } else if (isDeleting.current && charIndex.current === 0) {
          isDeleting.current = false;
          fraseIndex.current = (fraseIndex.current + 1) % frases.length;
        }
      },
      isDeleting.current ? 100 : 200,
    );

    return () => clearTimeout(timeout);
  }, [text]);

  return (
    <div className={style.TypewriterContainer}>
      <h1 className={style.header}>
        {initText} <span className={style.typingText}>{text}</span>
      </h1>
    </div>
  );
}
