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

// 場に出ているキャラクターの受動能力(FREE_TRAP_COST)により、トラップ発動コストが0になるか判定する
function getTrapCostToPay(player, card) {
    const baseCard = cardDatabase[player.currentCard];
    if (baseCard && baseCard.abilities) {
        const passive = baseCard.abilities.find(a => a.type === 'passive' && a.effectId === 'FREE_TRAP_COST');
        if (passive) {
            const rankOrder = ["I", "II", "III", "IV", "V"];
            const rankIndex = rankOrder.indexOf(card.rank) + 1;
            if (rankIndex > 0 && rankIndex <= passive.params.maxRank) return 0;
        }
    }
    return card.cost;
}

function drawCard(player, n) {
    const other = (player === myPlayer) ? opponent : myPlayer;
    const otherBase = cardDatabase[other.currentCard];
    const replaceAbility = otherBase && otherBase.abilities && otherBase.abilities.find(a =>
        a.type === 'triggered' && a.trigger === 'opponentDraws' && a.effectId === 'REPLACE_DRAW_WITH_DISCARD'
    );

    let drewAny = false;
    for (let i = 0; i < n; i++) {
        if (gameOver) return;

        if (replaceAbility) {
            updateDisplay(`🌀 ${getPlayerLabel(other)}の「${otherBase.name}」の能力：${getPlayerLabel(player)}はドローの代わりに手札を1枚捨てる。`);
            discardRandom(player, 1);
            drewAny = true;
            continue;
        }

        if (player.deck.length === 0) {
            endGame(player, '山札切れ');
            return;
        }
        const cardId = player.deck.shift();
        player.hand.push(cardId);
        drewAny = true;
    }

    if (drewAny) checkTrapTriggers('opponentDraws', other, player);
}

function startTurn() {
    if (gameOver) return;
    turnCount++;
    const player = getActivePlayer();

    player.od = player.maxOd;
    if (player.trapSealedTurns > 0) player.trapSealedTurns--;
    if (player.abilitySealedTurns > 0) player.abilitySealedTurns--;
    refreshFieldDisplay(player); // ★ コスト回復が画面に反映されていなかった原因

    if (player.firstTurnTaken) {
        drawCard(player, 1);
    } else {
        player.firstTurnTaken = true;
        updateDisplay(`${getPlayerLabel(player)}は初期手札5枚からスタート（このターンはドローなし）`);
    }

    updateTurnIndicator();
    updateHandDisplay();
    updateBattleDeckCounts();
    renderAbilityButtons();

    updateDisplay(`--- ${turnCount}ターン目：${getPlayerLabel(player)}の番 ---`);

    runControllerTurn(player);
}

function endTurn() {
    if (gameOver) return;
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
    if (gameOver) return;
    const player = getActivePlayer();
    const cardId = player.hand[index];
    const card = cardDatabase[cardId];
    if (!card) return;

    if (card.type === 'マジック') {
        useMagic(index);
    } else if (card.type === 'トラップ') {
        setTrapFromHand(index);
    } else if (card.type === '素材') {
        useMaterialCard(index);
    } else if (card.type === 'キー') {
        useKeyCard(index);
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
    const defenderBase = cardDatabase[defender.currentCard];
    const destroyAbility = defenderBase && defenderBase.abilities && defenderBase.abilities.find(a =>
        a.type === 'triggered' && a.trigger === 'opponentActivatesMagic' && a.effectId === 'REPLACE_MAGIC_WITH_DESTROY'
    );

    if (destroyAbility) {
        updateDisplay(`🌀 ${getPlayerLabel(defender)}の「${defenderBase.name}」の能力：${card.name}は効果を発動せず破壊された。`);
    } else {
        const negatingTrap = tryNegateAny(defender, 'opponentActivatesMagic', card);
        if (negatingTrap) {
            // 2段階目：無効化トラップの発動自体を、行動者側の無効化トラップでさらに打ち消せるか確認
            const counterTrap = tryNegate(player, 'opponentActivatesTrap', negatingTrap);
            if (counterTrap) {
                updateDisplay(`↩️ 「${negatingTrap.name}」が「${counterTrap.name}」でさらに無効化され、${card.name}の効果が発動する！`);
                applyCardEffect(card.effectId, card.params, player, defender);
            } else {
                updateDisplay(`🚫 ${card.name} は無効化された！`);
            }
        } else {
            applyCardEffect(card.effectId, card.params, player, defender);
        }
    }

    refreshFieldDisplay(player);
    updateHandDisplay();
    updateGraveyardDisplay(player);
    renderAbilityButtons();
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

// --- 覚醒システム（素材カード・キーカード） ---

function useMaterialCard(index) {
    const player = getActivePlayer();
    const cardId = player.hand[index];
    const card = cardDatabase[cardId];
    if (!card || card.type !== '素材') return;

    if (card.cost > player.od) {
        updateDisplay(`❌ コストが足りません（必要:${card.cost} / 所持:${player.od}）`);
        return;
    }
    if (player.currentCard !== card.parentCharacterId) {
        updateDisplay(`❌ ${card.name} は今場に出ているキャラクターには使用できません。`);
        return;
    }
    if (player.usedMaterials.includes(cardId)) {
        updateDisplay(`⚠️ ${card.name} はすでに使用済みです。`);
        return;
    }

    payCost(player, card.cost);
    player.hand.splice(index, 1);
    player.graveyard.push(cardId);
    player.usedMaterials.push(cardId);

    updateDisplay(`🔹 ${getPlayerLabel(player)}が「${card.name}」を使用（覚醒の証：${player.usedMaterials.length}/3）`);

    refreshFieldDisplay(player);
    updateHandDisplay();
    updateGraveyardDisplay(player);
    renderAbilityButtons();
}

function useKeyCard(index) {
    const player = getActivePlayer();
    const cardId = player.hand[index];
    const card = cardDatabase[cardId];
    if (!card || card.type !== 'キー') return;

    if (card.cost > player.od) {
        updateDisplay(`❌ コストが足りません（必要:${card.cost} / 所持:${player.od}）`);
        return;
    }
    if (player.currentCard !== card.parentCharacterId) {
        updateDisplay(`❌ ${card.name} は今場に出ているキャラクターには使用できません。`);
        return;
    }

    const requiredMaterials = card.materials || [];
    const allReady = requiredMaterials.length > 0 &&
        requiredMaterials.every(matId => player.usedMaterials.includes(matId));

    if (!allReady) {
        const done = requiredMaterials.filter(matId => player.usedMaterials.includes(matId)).length;
        updateDisplay(`❌ 覚醒条件を満たしていません（証 ${done}/${requiredMaterials.length}）`);
        return;
    }

    payCost(player, card.cost);
    player.hand.splice(index, 1);
    player.graveyard.push(cardId);

    awakenCharacter(player, card.resultId);
    updateGraveyardDisplay(player);
}

function awakenCharacter(player, resultId) {
    const exCard = cardDatabase[resultId];
    if (!exCard) {
        updateDisplay(`❌ 覚醒先カード「${resultId}」が見つかりません`);
        return;
    }

    player.currentCard = resultId;
    player.hp = exCard.hp;
    player.maxHp = exCard.hp;
    player.od = exCard.od;
    player.maxOd = exCard.od;
    player.usedMaterials = [];
    player.characterNegateCharges = {};

    updateDisplay(`✨✨ ${getPlayerLabel(player)}のキャラクターが覚醒！「${exCard.name}」になった！`);

    refreshFieldDisplay(player);
    updateHandDisplay();
    renderAbilityButtons();
}

// --- キャラクター能力（① ②）の発動 ---

function renderAbilityButtons() {
    const area = document.getElementById('my-ability-area');
    if (!area) return;
    area.innerHTML = "";

    const player = getActivePlayer();
    if (player !== myPlayer || !isHumanControlled(player)) return; // 自分の手番でなければ表示しない

    const baseCard = cardDatabase[player.currentCard];
    if (!baseCard || !baseCard.abilities) return;

    baseCard.abilities.forEach((ability, index) => {
        if (ability.type !== 'active') return; // passive/triggeredはボタン不要（自動判定）

        const btn = document.createElement("button");
        btn.innerText = `能力：${ability.text}${ability.cost > 0 ? `（コスト${ability.cost}）` : ''}`;
        btn.disabled = player.abilitySealedTurns > 0 || ability.cost > player.od;
        btn.onclick = () => useCharacterAbility(index);
        area.appendChild(btn);
    });

    if (player.abilitySealedTurns > 0) {
        const notice = document.createElement("div");
        notice.innerText = `⚠️ キャラクター能力は封印中（残り${player.abilitySealedTurns}ターン）`;
        area.appendChild(notice);
    }
}

function useCharacterAbility(abilityIndex) {
    if (gameOver) return;
    const player = getActivePlayer();
    if (!isHumanControlled(player)) return;

    if (player.abilitySealedTurns > 0) {
        updateDisplay(`❌ キャラクター能力は現在封印されています。`);
        return;
    }

    const baseCard = cardDatabase[player.currentCard];
    const ability = baseCard && baseCard.abilities && baseCard.abilities[abilityIndex];
    if (!ability || ability.type !== 'active') return;

    if (ability.cost > player.od) {
        updateDisplay(`❌ コストが足りません（必要:${ability.cost} / 所持:${player.od}）`);
        return;
    }

    payCost(player, ability.cost);
    updateDisplay(`💫 ${getPlayerLabel(player)}が能力発動：${ability.text}`);

    const defender = getDefendingPlayer();
    applyCardEffect(ability.effectId, ability.params, player, defender);

    checkTrapTriggers('opponentUsesAbility', defender, player);

    refreshFieldDisplay(player);
    renderAbilityButtons();
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
