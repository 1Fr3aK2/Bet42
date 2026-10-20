import { COINS } from '../data/constants';

export default function CoinSelector({ selectedCoin, onSelect }) {
  return (
    <div className="coin-selector">
      {COINS.map((coin) => (
        <button
          key={coin}
          className={`coin-btn ${coin === selectedCoin ? 'active' : ''}`}
          onClick={() => onSelect(coin)}
        >
          {coin}
        </button>
      ))}
    </div>
  );
}
