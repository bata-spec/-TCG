// assets.js - 画像素材のパスを一元管理する
// カードイラスト・裏面・バトル背景など、パスの文字列はここだけに書く。
// 他のファイルは getCardArtPath() / CARD_BACK_IMAGE などの関数・定数経由で参照する。

const IMAGE_BASE = "画像/";
const CARD_ART_DIR = IMAGE_BASE + "カードイラスト/";
const BATTLE_BG_DIR = IMAGE_BASE + "バトル画面素材/";

const CARD_BACK_IMAGE = CARD_ART_DIR + "ワルプルギスの夜裏面素材.png";
const MAGIC_GENERIC_IMAGE = CARD_ART_DIR + "マジック汎用.png";
const TRAP_GENERIC_IMAGE = CARD_ART_DIR + "トラップ汎用.webp";
const BATTLE_BG_IMAGE = BATTLE_BG_DIR + "ワルプルギスの夜バトル背景素材.png";

// キャラクターカードは名前でイラストに紐付ける。
// 新しいキャラを追加したら、ここに1行足すだけでよい。
const CHARACTER_ART_MAP = {
    "救国の魔女": CARD_ART_DIR + "救国の魔女.webp",
    "ジャンヌ・ダルク": CARD_ART_DIR + "救国の魔女EX.webp", // EX001の名前
    "亡国の魔女": CARD_ART_DIR + "亡国の魔女.webp",
    "マリー・アントワネット": CARD_ART_DIR + "亡国の魔女EX.webp" // EX002の名前
    // 「傾国の魔女」系はまだイラスト未着手のため未登録 → 自動でカード裏面にフォールバックする
};

// カード情報からイラストパスを返す。
// マジック/トラップは名前を問わず一律で汎用画像、キャラは名前で個別紐付け、
// 該当なしはカード裏面（プレースホルダー）にフォールバックする。
function getCardArtPath(card) {
    if (!card) return CARD_BACK_IMAGE;
    if (card.type === "マジック") return MAGIC_GENERIC_IMAGE;
    if (card.type === "トラップ") return TRAP_GENERIC_IMAGE;
    return CHARACTER_ART_MAP[card.name] || CARD_BACK_IMAGE;
}
