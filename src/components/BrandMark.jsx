// Brand mark: a cute little house with no face — soft domed roof, two lit windows
// and a mint door, plus a small floating heart. Bubblegum pink body, sunny roof,
// mint door, warm white windows. The old mark had a staring face (two big dark
// eyes + a wide grin) and a spiky snowflake badge that read as a spot on its
// cheek; both are gone. Big shapes only, so it still reads at favicon size.
// Used in the masthead; the favicon is the same mark without the heart.
export default function BrandMark({ className = 'h-6 w-6' }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" className={`block shrink-0 ${className}`}>
      <path d="M11 22 Q32 -6 53 22 Z" fill="#ffd23f" stroke="#1d1a3a" strokeWidth="3" strokeLinejoin="round" />
      <rect x="13" y="22" width="38" height="36" rx="12" fill="#ff5ca8" stroke="#1d1a3a" strokeWidth="3" />
      <rect x="19" y="30" width="9" height="9" rx="3" fill="#ffffff" stroke="#1d1a3a" strokeWidth="2.5" />
      <rect x="36" y="30" width="9" height="9" rx="3" fill="#ffffff" stroke="#1d1a3a" strokeWidth="2.5" />
      <rect x="27" y="41" width="10" height="17" rx="5" fill="#6ee7b7" stroke="#1d1a3a" strokeWidth="2.5" />
      <path d="M51 15 C47.5 11.8 45.5 9.8 46.4 7.9 C47.1 6.4 49.2 6.2 50.2 7.6 C50.5 8 51 8.8 51 8.8 C51 8.8 51.5 8 51.8 7.6 C52.8 6.2 54.9 6.4 55.6 7.9 C56.5 9.8 54.5 11.8 51 15 Z" fill="#ff5ca8" stroke="#1d1a3a" strokeWidth="1.8" strokeLinejoin="round" transform="rotate(8 51 10)" />
    </svg>
  )
}
