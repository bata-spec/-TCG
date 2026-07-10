// chain_system.js - トラップの発動条件監視・割り込み（チェーン）処理

// defender: トラップを持っている側 / attacker: トリガーを引き起こした側
function checkTrapTriggers(triggerName, defender, attacker) {
    for (let i = 0; i < defender.traps.length; i++) {
        const cardId = defender.traps[i];
        if (!cardId) continue;
        const card = cardDatabase[cardId];
        if (!card || card.trigger !== triggerName) continue;

        activateTrapAt(defender, i, attacker);
    }
}

function activateTrapAt(defender, slotIndex, attacker) {
    const cardId = defender.traps[slotIndex];
    const card = cardDatabase[cardId];
    if (!card) return;

    updateDisplay(`⚡ ${getPlayerLabel(defender)}のトラップ発動：${card.name}`);

    defender.traps[slotIndex] = null;
    defender.trapsRevealed[slotIndex] = false;
    defender.graveyard.push(cardId);

    applyCardEffect(card.effectId, card.params, defender, attacker);

    updateTrapDisplay();
    updateGraveyardDisplay(defender);
}

// 無効化系トラップ（TS_NEGATE_MAGIC / TS_NEGATE_TRAP）専用の判定。
// 発動条件を満たす罠が見つかったら消費して true を返す（元の効果は不発になる）。
// 罠が罠を無効化する多重チェーンには今は対応していない（今後の拡張ポイント）。
function tryNegate(defender, triggerName, sourceCard) {
    for (let i = 0; i < defender.traps.length; i++) {
        const cardId = defender.traps[i];
        if (!cardId) continue;
        const trapCard = cardDatabase[cardId];
        if (!trapCard || trapCard.trigger !== triggerName) continue;
        if (trapCard.params && typeof trapCard.params.maxCost === 'number' && sourceCard.cost > trapCard.params.maxCost) continue;

        updateDisplay(`⚡ ${getPlayerLabel(defender)}のトラップ発動：${trapCard.name}`);
        defender.traps[i] = null;
        defender.trapsRevealed[i] = false;
        defender.graveyard.push(cardId);
        updateTrapDisplay();
        updateGraveyardDisplay(defender);
        return true;
    }
    return false;
}
