export default function CoinSelector({ coins, selectedCoin, onSelect }) {
  return (
    <div className="coin-selector" role="group" aria-label="Coin">
      {coins.map((coin) => (
        <button
          key={coin}
          aria-pressed={coin === selectedCoin}
          className={`coin-btn ${coin === selectedCoin ? 'active' : ''}`}
          onClick={() => onSelect(coin)}
        >
          {coin}
        </button>
      ))}
    </div>
  );
}
