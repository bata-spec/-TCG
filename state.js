// state.js - ゲームの状態を一元管理する(ここだけで宣言)

// エラー表示はアプリ全体でここ1箇所だけに定義する。
// 他のファイルでは絶対に window.onerror を再定義しないこと。
// （過去に複数ファイルで再定義され、最後に読まれたファイルの alert() 版で
// 　上書きされてしまい、エラー発生時に画面が固まる不具合があったため）
window.onerror = function (msg, url, line) {
    const output = document.getElementById('output');
    if (output) {
        output.innerHTML += `<br><span style="color:red">⚠️ ERROR: ${msg} (line ${line})</span>`;
    }
    return false;
};

let cardDatabase = {};

function createPlayer() {
    return {
        currentCard: null, hp: 0, maxHp: 0,
        od: 0, maxOd: 0,
        deathCount: 0,
        firstTurnTaken: false, // false のうちは初期手札分のみ（ターン開始時ドローをスキップ）
        deck: [], hand: [], graveyard: [],
        traps: [null, null, null, null, null],
        trapsRevealed: [false, false, false, false, false],
        trapSealedTurns: 0,
        damageReduction: 0,
        reflectShield: 0,
        controllerType: null,      // 'human' | 'ai' | 'network'
        selectedCharacterId: null,
        builtDeck: [],
        // --- ネットワーク対戦用（未実装・項目のみ） ---
        networkPlayerId: null,
        networkSessionId: null
    };
}

let myPlayer = createPlayer();
let opponent = createPlayer();

let gameMode = null; // 'single' | 'local2p' | 'network'（未実装）

let turnCount = 0;
let currentTurnPlayer = 'me';

// --- デッキ構築セッション用の一時状態（今構築中のプレイヤーの選択） ---
let selectedCharacterId = null;
let deckSelection = {};
let deck = [];

const DECK_MIN = 40;
const DECK_MAX = 60;
const MAX_COPIES_PER_CARD = 3;
const MAX_TRAPS = 5;
