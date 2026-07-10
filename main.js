// main.js - 初期化処理(司令塔役)

function onDataLoaded() {
    updateDisplay("デッキを構築してください。");
    gameMode = 'single'; // 現状は「自分 vs AI」のみ対応
    initDeckBuilder();
}

function summonCharacter(player, cardId, charElementId, statusElementId) {
    const card = cardDatabase[cardId];
    if (!card) {
        updateDisplay(`❌ カードID「${cardId}」が見つかりません`);
        return;
    }
    player.currentCard = cardId;
    player.hp = card.hp;
    player.maxHp = card.hp;
    player.od = card.od;
    player.maxOd = card.od;
    updateFieldDisplay(player, charElementId, statusElementId);
    updateDisplay(`[召喚] ${card.name} 配置！`);
}

function buildRandomOpponentDeck() {
    const pool = Object.values(cardDatabase).filter(c => c.type === "マジック" || c.type === "トラップ");
    const result = [];
    for (let i = 0; i < DECK_MIN; i++) {
        result.push(pool[Math.floor(Math.random() * pool.length)].id);
    }
    return result;
}

function pickRandomOpponentCharacter() {
    const characterIds = Object.keys(cardDatabase).filter(id => !cardDatabase[id].type && !id.startsWith("EX"));
    return characterIds[Math.floor(Math.random() * characterIds.length)];
}

function initBattle() {
    // --- 自分側のセットアップ ---
    myPlayer.deck = deck.slice();
    myPlayer.hand = [];
    myPlayer.graveyard = [];
    myPlayer.traps = [null, null, null, null, null];
    myPlayer.trapsRevealed = [false, false, false, false, false];
    myPlayer.trapSealedTurns = 0;
    myPlayer.damageReduction = 0;
    myPlayer.reflectShield = 0;
    myPlayer.deathCount = 0;
    myPlayer.firstTurnTaken = false;
    myPlayer.controllerType = CONTROLLER_TYPES.HUMAN; // ★ これが漏れていたのが手札非表示の原因

    summonCharacter(myPlayer, selectedCharacterId, "my-character", "my-status");

    // --- 相手側のセットアップ（現状はAIの自動対戦相手） ---
    opponent.deck = buildRandomOpponentDeck();
    shuffleDeck(opponent.deck);
    opponent.hand = [];
    opponent.graveyard = [];
    opponent.traps = [null, null, null, null, null];
    opponent.trapsRevealed = [false, false, false, false, false];
    opponent.trapSealedTurns = 0;
    opponent.damageReduction = 0;
    opponent.reflectShield = 0;
    opponent.deathCount = 0;
    opponent.firstTurnTaken = false;
    opponent.controllerType = CONTROLLER_TYPES.AI;

    summonCharacter(opponent, pickRandomOpponentCharacter(), "opponent-character", "opponent-status");

    // --- 初期手札 ---
    drawCard(myPlayer, 5);
    drawCard(opponent, 5);

    turnCount = 0;
    currentTurnPlayer = 'me';

    updateTrapDisplay();
    updateBattleDeckCounts();
    updateGraveyardDisplay(myPlayer);
    updateGraveyardDisplay(opponent);
    updateHandDisplay();

    updateDisplay(`山札構築完了：自分 ${myPlayer.deck.length}枚 / 相手 ${opponent.deck.length}枚`);

    startTurn();
}
