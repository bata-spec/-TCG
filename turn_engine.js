// turn_engine.js - ターン進行の管理、マジック/トラップの使用処理、場のトラップ表示

function getActivePlayer() {
    return currentTurnPlayer === 'me' ? myPlayer : opponent;
}
function getDefendingPlayer() {
    return currentTurnPlayer === 'me' ? opponent : myPlayer;
}

function payCost(player, cost) {
    player.od = Math.max(0, player.od - cost);
}

function drawCard(player, n) {
    const label = getPlayerLabel(player);
    for (let i = 0; i < n; i++) {
        if (player.deck.length === 0) {
            updateDisplay(`⚠️ ${label}の山札が0枚です（山札切れ判定は未実装）`);
            break;
        }
        const cardId = player.deck.shift();
        player.hand.push(cardId);
    }
}

function startTurn() {
    turnCount++;
    const player = getActivePlayer();

    player.od = player.maxOd;
    if (player.trapSealedTurns > 0) player.trapSealedTurns--;

    if (player.firstTurnTaken) {
        drawCard(player, 1);
    } else {
        player.firstTurnTaken = true;
        updateDisplay(`${getPlayerLabel(player)}は初期手札5枚からスタート（このターンはドローなし）`);
    }

    updateTurnIndicator();
    updateHandDisplay();
    updateBattleDeckCounts();

    updateDisplay(`--- ${turnCount}ターン目：${getPlayerLabel(player)}の番 ---`);

    runControllerTurn(player);
}

function endTurn() {
    currentTurnPlayer = (currentTurnPlayer === 'me') ? 'opponent' : 'me';
    maybeShowPassScreen();
    startTurn();
}

// ローカル2人対戦で「画面を相手に渡す」演出をはさむためのフック。
// 該当する要素がある場合のみ動作し、無ければ何もしない（要素未実装でも落ちない）
function maybeShowPassScreen() {
    if (gameMode !== 'local2p') return;
    const passScreen = document.getElementById('pass-screen');
    const passMsg = document.getElementById('pass-screen-message');
    if (!passScreen || !passMsg) return; // 未実装環境では安全にスキップ
    passMsg.innerText = `${getPlayerLabel(getActivePlayer())}に画面を渡してください`;
    passScreen.style.display = 'block';
}

function handleHandCardClick(index) {
    const player = getActivePlayer();
    const cardId = player.hand[index];
    const card = cardDatabase[cardId];
    if (!card) return;

    if (card.type === 'マジック') {
        useMagic(index);
    } else if (card.type === 'トラップ') {
        setTrapFromHand(index);
    } else {
        updateDisplay(`⚠️ ${card.name} はまだプレイ方法が実装されていません。`);
    }
}

function useMagic(index) {
    const player = getActivePlayer();
    const cardId = player.hand[index];
    const card = cardDatabase[cardId];
    if (!card || card.type !== 'マジック') return;

    if (card.cost > player.od) {
        updateDisplay(`❌ コストが足りません（必要:${card.cost} / 所持:${player.od}）`);
        return;
    }

    payCost(player, card.cost);
    player.hand.splice(index, 1);
    player.graveyard.push(cardId);
    updateDisplay(`✨ ${getPlayerLabel(player)}がマジック発動：${card.name}`);

    const defender = getDefendingPlayer();
    const negated = tryNegate(defender, 'opponentActivatesMagic', card);
    if (negated) {
        updateDisplay(`🚫 ${card.name} は無効化された！`);
    } else {
        applyCardEffect(card.effectId, card.params, player, defender);
    }

    refreshFieldDisplay(player);
    updateHandDisplay();
    updateGraveyardDisplay(player);
}

function setTrapFromHand(index) {
    const player = getActivePlayer();
    const cardId = player.hand[index];
    const card = cardDatabase[cardId];
    if (!card || card.type !== 'トラップ') return;

    if (player.trapSealedTurns > 0) {
        updateDisplay(`❌ 現在トラップは封印されていてセットできません。`);
        return;
    }

    const emptySlot = player.traps.findIndex(t => t === null);
    if (emptySlot === -1) {
        updateDisplay(`❌ トラップゾーンに空きがありません（最大${MAX_TRAPS}枚）`);
        return;
    }

    player.hand.splice(index, 1);
    player.traps[emptySlot] = cardId;
    player.trapsRevealed[emptySlot] = false;
    updateDisplay(`🔒 ${getPlayerLabel(player)}がトラップをセットした。`);

    updateHandDisplay();
    updateTrapDisplay();
}

// --- 場の描画（デッキ枚数・トラップゾーン） ---

function updateBattleDeckCounts() {
    const myCount = document.getElementById('my-deck-count');
    const oppCount = document.getElementById('opponent-deck-count');
    if (myCount) myCount.innerText = `${myPlayer.deck.length}`;
    if (oppCount) oppCount.innerText = `${opponent.deck.length}`;

    const myArt = document.getElementById('my-deck-art');
    const oppArt = document.getElementById('opponent-deck-art');
    if (myArt) myArt.style.visibility = myPlayer.deck.length > 0 ? 'visible' : 'hidden';
    if (oppArt) oppArt.style.visibility = opponent.deck.length > 0 ? 'visible' : 'hidden';
}

function renderTrapZone(player, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    for (let i = 0; i < player.traps.length; i++) {
        const slot = document.createElement("div");
        slot.className = "trap-slot";
        const cardId = player.traps[i];

        if (!cardId) {
            slot.classList.add("trap-slot-empty");
        } else {
            const img = document.createElement("img");
            img.className = "trap-art";
            const canReveal = (player === getActivePlayer()) && isHumanControlled(player);
            const card = cardDatabase[cardId];
            const revealed = player.trapsRevealed[i];

            if (revealed || (player === myPlayer)) {
                setImageWithFallback(img, getCardArtPath(card));
                img.onclick = () => showCardDetail(cardId);
            } else {
                setImageWithFallback(img, CARD_BACK_IMAGE);
            }
            slot.appendChild(img);
        }
        container.appendChild(slot);
    }
}

function updateTrapDisplay() {
    renderTrapZone(myPlayer, "my-trap-zone");
    renderTrapZone(opponent, "opponent-trap-zone");
}

function updateTurnIndicator() {
    const el = document.getElementById('turn-indicator');
    if (el) el.innerText = `ターン: ${turnCount} / 手番: ${getPlayerLabel(getActivePlayer())}`;
}
