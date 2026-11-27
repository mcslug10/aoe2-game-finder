"use client";

import styles from "./warrior-hero.module.css";

export default function CoachWarriorHero() {
  return <div className={styles.scene} aria-label="Cavaleiro medieval inspirado em Age of Empires II, com animação de flutuação">
    <div className={styles.sun}/>
    <div className={styles.ring}/>
    <div className={styles.floor}/>
    <div className={styles.particles}><i/><i/><i/><i/><i/><i/></div>
    <svg className={styles.knight} viewBox="0 0 360 430" role="img" aria-hidden="true">
      <defs>
        <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f3f1df"/><stop offset=".28" stopColor="#9da9ad"/><stop offset=".55" stopColor="#465866"/><stop offset=".78" stopColor="#d5d8ca"/><stop offset="1" stopColor="#34434c"/></linearGradient>
        <linearGradient id="gold" x1="0" y1="0" x2="0.8" y2="1"><stop stopColor="#fff0a8"/><stop offset=".45" stopColor="#c58d3c"/><stop offset="1" stopColor="#68431e"/></linearGradient>
        <linearGradient id="cape" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#a52e24"/><stop offset=".55" stopColor="#5d1719"/><stop offset="1" stopColor="#260e18"/></linearGradient>
        <radialGradient id="glow"><stop stopColor="#f4cf83" stopOpacity=".75"/><stop offset="1" stopColor="#e6a449" stopOpacity="0"/></radialGradient>
        <filter id="shadow"><feGaussianBlur stdDeviation="5"/></filter>
      </defs>
      <ellipse cx="180" cy="394" rx="94" ry="18" fill="#000" opacity=".42" filter="url(#shadow)"/>
      <g className={styles.cape}>
        <path d="M139 157 Q103 190 94 277 L131 358 Q169 326 204 347 L238 260 Q220 192 206 160Z" fill="url(#cape)" stroke="#d69b52" strokeWidth="3"/>
        <path d="M132 186 Q117 260 139 330 M204 184 Q224 260 207 321" fill="none" stroke="#e2ad6b" strokeOpacity=".42" strokeWidth="3"/>
      </g>
      <g className={styles.body}>
        <path d="M140 170 L111 207 L133 278 L157 267 L158 212Z" fill="url(#steel)" stroke="#253744" strokeWidth="5"/>
        <path d="M213 169 L245 199 L226 273 L203 264 L198 211Z" fill="url(#steel)" stroke="#253744" strokeWidth="5"/>
        <path d="M143 160 Q180 145 216 161 L232 267 Q181 291 126 266Z" fill="url(#steel)" stroke="#263946" strokeWidth="6"/>
        <path d="M137 191 L221 191 M132 222 L226 222 M132 251 L228 251" stroke="#263946" strokeWidth="5"/>
        <path d="M158 164 L180 182 L202 164 L198 267 L162 267Z" fill="#b8c2bd" stroke="#3a4b54" strokeWidth="3"/>
        <path d="M180 183 L180 264" stroke="#e5c16f" strokeWidth="4"/>
        <path d="M146 273 L214 273 L203 337 L159 337Z" fill="url(#steel)" stroke="#263946" strokeWidth="5"/>
        <path d="M150 287 L210 287 L207 300 L153 300Z" fill="url(#gold)" stroke="#543a1f" strokeWidth="3"/>
        <path d="M160 336 L183 337 L177 389 L142 389 L145 365Z" fill="url(#steel)" stroke="#263946" strokeWidth="5"/>
        <path d="M190 337 L213 333 L224 369 L217 389 L183 389Z" fill="url(#steel)" stroke="#263946" strokeWidth="5"/>
        <path d="M140 387 L179 387 L182 403 L127 403 Q120 396 140 387Z" fill="#202b35" stroke="#d1a75e" strokeWidth="3"/>
        <path d="M184 387 L219 385 L240 403 L184 403Z" fill="#202b35" stroke="#d1a75e" strokeWidth="3"/>
      </g>
      <g className={styles.head}>
        <path d="M145 95 Q180 69 216 96 L209 148 Q181 173 151 147Z" fill="url(#steel)" stroke="#263946" strokeWidth="6"/>
        <path d="M139 105 L180 78 L221 105 L214 119 L146 119Z" fill="url(#gold)" stroke="#4d371f" strokeWidth="5"/>
        <path d="M154 123 L206 123 L202 143 L180 157 L158 142Z" fill="#344653" stroke="#d5d7cb" strokeWidth="3"/>
        <path d="M160 128 L178 128 L178 139 L160 139Z M184 128 L201 128 L199 139 L184 139Z" fill="#f4d889"/>
        <path d="M178 129 L184 129 L184 151 L180 155 L176 151Z" fill="#151e28"/>
        <path d="M145 105 L129 120 L145 132 M215 105 L231 120 L215 132" fill="none" stroke="#c9d0c8" strokeWidth="7"/>
        <path d="M179 78 L179 56 L167 42 L193 42 L181 56 L184 78Z" fill="url(#gold)" stroke="#51391e" strokeWidth="3"/>
      </g>
      <g className={styles.shield}>
        <path d="M84 208 L132 222 L128 287 Q105 318 80 331 Q53 305 49 278 L53 220Z" fill="#263b4c" stroke="url(#gold)" strokeWidth="7"/>
        <path d="M90 232 L112 252 L90 293 L68 252Z" fill="#c8a45b" stroke="#f2d58b" strokeWidth="3"/>
        <path d="M90 242 L90 281 M76 261 L104 261" stroke="#f1d998" strokeWidth="5"/>
      </g>
      <g className={styles.sword}>
        <path d="M259 75 L273 66 L287 192 L277 216 L266 190Z" fill="url(#steel)" stroke="#293b47" strokeWidth="4"/>
        <path d="M250 205 L295 198 L299 211 L247 219Z" fill="url(#gold)" stroke="#4c351e" strokeWidth="4"/>
        <path d="M270 215 L283 212 L295 256 L282 262Z" fill="#563b25" stroke="#d5b36e" strokeWidth="4"/>
        <circle cx="289" cy="264" r="9" fill="url(#gold)" stroke="#51371e" strokeWidth="3"/>
      </g>
    </svg>
    <div className={styles.caption}><span>AGE OF EMPIRES II</span><b>FORJADO NA BATALHA</b></div>
  </div>;
}