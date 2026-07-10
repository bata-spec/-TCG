// effects.js - マジック・トラップカードの効果解決（effectId + params を元に実行）

function applyCardEffect(effectId, params, self, opponent) {
    switch (effectId) {
        case 'MS_DRAW':
        case 'TS_DRAW':
            drawCard(self, params.n);
            updateHandDisplay();
            break;

        case 'MS_DMG':
        case 'MS_DMG_ALL':
        case 'TS_COUNTER':
            dealDamageTo(opponent, params.amount);
            break;

        case 'MS_HEAL':
        case 'TS_HEAL':
            healPlayer(self, params.amount);
            break;

        case 'MS_OD_BOOST':
            self.od = Math.min(self.maxOd, self.od + params.amount);
            updateDisplay(`コストが${params.amount}回復した。`);
            refreshFieldDisplay(self);
            break;

        case 'MS_DISCARD_OPP':
        case 'TS_FORCE_DISCARD':
            discardRandom(opponent, params.n);
            break;

        case 'MS_SEAL_TRAP':
        case 'TS_SEAL_ABILITY':
            opponent.trapSealedTurns = (opponent.trapSealedTurns || 0) + params.duration;
            updateDisplay(`相手の行動が${params.duration}ターン封印された。`);
            break;

        case 'MS_REVEAL_TRAP':
            revealTraps(opponent, params.n);
            break;

        case 'MS_FETCH':
            fetchFromDeck(self, params.n);
            break;

        case 'MS_DESTROY_TRAP':
            destroyTraps(opponent, params.n);
            break;

        case 'TS_REDUCE_DMG':
            self.damageReduction = (self.damageReduction || 0) + params.amount;
            updateDisplay(`次に受けるダメージが${params.amount}軽減される。`);
            break;

        case 'TS_OD_DRAIN':
            opponent.od = Math.max(0, opponent.od - params.amount);
            updateDisplay(`相手のコストが${params.amount}減少した。`);
            refreshFieldDisplay(opponent);
            break;

        case 'TS_REFLECT_SEAL':
            self.reflectShield = (self.reflectShield || 0) + params.uses;
            updateDisplay(`破壊を${params.uses}回無効化する効果を得た。`);
            break;

        case 'TS_NEGATE_TRAP':
            updateDisplay(`（対象となるトラップの発動がなかったため効果は不発だった）`);
            break;

        default:
            updateDisplay(`（${effectId} の効果は未実装です）`);
    }

    updateTrapDisplay();
    updateBattleDeckCounts();
    updateGraveyardDisplay(myPlayer);
    updateGraveyardDisplay(opponent);
}

function dealDamageTo(player, amount) {
    let dmg = amount;
    if (player.damageReduction) {
        const reduced = Math.min(player.damageReduction, dmg);
        dmg -= reduced;
        player.damageReduction = 0;
        updateDisplay(`ダメージ軽減効果で${reduced}軽減！`);
    }
    const charId = player === myPlayer ? "my-character" : "opponent-character";
    const statusId = player === myPlayer ? "my-status" : "opponent-status";
    applyDamage(player, dmg, charId, statusId);
}

function healPlayer(player, amount) {
    player.hp = Math.min(player.maxHp, player.hp + amount);
    updateDisplay(`HPが${amount}回復した。`);
    refreshFieldDisplay(player);
}

function discardRandom(player, n) {
    const label = getPlayerLabel(player);
    for (let i = 0; i < n; i++) {
        if (player.hand.length === 0) break;
        const idx = Math.floor(Math.random() * player.hand.length);
        const cardId = player.hand.splice(idx, 1)[0];
        player.graveyard.push(cardId);
        const card = cardDatabase[cardId];
        updateDisplay(`${label}は${card ? card.name : cardId}を捨てた。`);
    }
    updateHandDisplay();
}

function revealTraps(player, n) {
    let revealedCount = 0;
    for (let i = 0; i < player.traps.length && revealedCount < n; i++) {
        if (player.traps[i] && !player.trapsRevealed[i]) {
            player.trapsRevealed[i] = true;
            revealedCount++;
            const card = cardDatabase[player.traps[i]];
            updateDisplay(`トラップが公開された：${card ? card.name : player.traps[i]}`);
        }
    }
}

function fetchFromDeck(player, n) {
    const label = getPlayerLabel(player);
    for (let i = 0; i < n; i++) {
        if (player.deck.length === 0) break;
        const idx = Math.floor(Math.random() * player.deck.length);
        const cardId = player.deck.splice(idx, 1)[0];
        player.hand.push(cardId);
        const card = cardDatabase[cardId];
        updateDisplay(`${label}は山札から${card ? card.name : cardId}を手札に加えた。`);
    }
    updateHandDisplay();
}

function destroyTraps(player, n) {
    let destroyedCount = 0;
    for (let i = 0; i < player.traps.length && destroyedCount < n; i++) {
        if (player.traps[i]) {
            const card = cardDatabase[player.traps[i]];
            updateDisplay(`トラップを破壊した：${card ? card.name : player.traps[i]}`);
            player.graveyard.push(player.traps[i]);
            player.traps[i] = null;
            player.trapsRevealed[i] = false;
            destroyedCount++;
        }
    }
}
