// controllers.js - 操作主体（人間 / AI / ネットワーク）の抽象化

const CONTROLLER_TYPES = {
    HUMAN: 'human',
    AI: 'ai',
    NETWORK: 'network' // 今後実装予定
};

function isHumanControlled(player) {
    return player.controllerType === CONTROLLER_TYPES.HUMAN;
}

// 手番プレイヤーの操作主体に応じて処理を振り分ける
function runControllerTurn(player) {
    switch (player.controllerType) {
        case CONTROLLER_TYPES.AI:
            runAiTurn(player);
            break;
        case CONTROLLER_TYPES.NETWORK:
            runNetworkTurn(player);
            break;
        case CONTROLLER_TYPES.HUMAN:
        default:
            // 人間の操作を待つ（手札ボタン・ターンエンドボタンから続行）
            break;
    }
}

// --- AI操作 ---
// 自分のターン中：使えるマジックを優先度順に使い切り、出せるならトラップを1枚セットして終了する。
// （相手＝人間側のトラップ発動は、それとは別に chain_system.js が行動のたびに自動判定している）
function runAiTurn(player) {
    if (gameOver) return;
    setTimeout(() => aiPlayTurn(player), 600);
}

function aiPlayTurn(player) {
    if (gameOver) return;
    playAllAffordableAiMagic(player);

    const trapIndex = player.hand.findIndex(id => cardDatabase[id] && cardDatabase[id].type === 'トラップ');
    const hasEmptySlot = player.traps.includes(null);
    if (trapIndex !== -1 && hasEmptySlot && player.trapSealedTurns === 0) {
        setTrapFromHand(trapIndex);
    }

    updateDisplay(`${getPlayerLabel(player)}（AI）のターンを終了します。`);
    setTimeout(() => endTurn(), 500);
}

function playAllAffordableAiMagic(player) {
    let played = true;
    let safety = 0; // 無限ループ防止
    while (played && safety < 20) {
        played = false;
        safety++;
        const index = findBestAiMagicIndex(player);
        if (index !== -1) {
            useMagic(index);
            played = true;
        }
    }
}

// ダメージ系を優先し、その中では最もコストが高い（強力な）ものを選ぶ簡易評価
function findBestAiMagicIndex(player) {
    let bestIndex = -1;
    let bestScore = -1;

    player.hand.forEach((cardId, idx) => {
        const card = cardDatabase[cardId];
        if (!card || card.type !== 'マジック') return;
        if (card.cost > player.od) return;

        const isDamage = (card.effectId === 'MS_DMG' || card.effectId === 'MS_DMG_ALL');
        const score = (isDamage ? 100 : 0) + card.cost;

        if (score > bestScore) {
            bestScore = score;
            bestIndex = idx;
        }
    });

    return bestIndex;
}

// --- ネットワーク対戦用（未実装・項目のみ用意） ---
function runNetworkTurn(player) {
    // TODO: サーバー/DBから相手の行動を受信して同期する処理を実装する
    updateDisplay('（ネットワーク対戦は未実装です）');
}

function sendActionToServer(action) {
    // TODO: 自分の行動（マジック使用・トラップセット・ターンエンド等）をサーバーに送信する
}

function receiveActionFromServer() {
    // TODO: サーバーから相手の行動を受信してゲーム状態に反映する
}

function connectToNetworkSession(sessionId, playerId) {
    // TODO: サーバー/DBに接続し、対戦セッションに参加する処理を実装する
}
