export default function Toast({ msg, type, show }) {
  return <div className={`toast ${type} ${show ? 'show' : ''}`}>{msg}</div>;
}
