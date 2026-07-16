// turn_engine.js - ターン進行の管理、マジック/トラップの使用処理、場のトラップ表示、能力表示

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

async function drawCard(player, n) {
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
            await discardCardsFromHand(player, 1);
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

    if (drewAny) await checkTrapTriggers('opponentDraws', other, player);
}

async function startTurn() {
    if (gameOver) return;
    turnCount++;
    const player = getActivePlayer();

    player.od = player.maxOd;
    player.usedAbilitiesThisTurn = {}; // 能力の「1ターンに1回」制限を、自分の手番開始時にリセット
    if (player.trapSealedTurns > 0) player.trapSealedTurns--;
    if (player.abilitySealedTurns > 0) player.abilitySealedTurns--;

    if (player.firstTurnTaken) {
        await drawCard(player, 1);
        if (gameOver) return;
    } else {
        player.firstTurnTaken = true;
        updateDisplay(`${getPlayerLabel(player)}は初期手札5枚からスタート（このターンはドローなし）`);
    }

    updateTurnIndicator();
    updateHandDisplay();
    updateBattleDeckCounts();
    refreshAbilityDisplay();

    updateDisplay(`--- ${turnCount}ターン目：${getPlayerLabel(player)}の番 ---`);

    runControllerTurn(player);
}

async function endTurn() {
    if (gameOver) return;
    currentTurnPlayer = (currentTurnPlayer === 'me') ? 'opponent' : 'me';

    if (gameMode === 'local2p') {
        await showPassScreen(
            `${getPlayerLabel(getActivePlayer())}に端末を渡してください`,
            `${getPlayerLabel(getActivePlayer())}が準備できたらタップ`
        );
    }

    await startTurn();
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

async function useMagic(index) {
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
        // 無効化（トラップ or キャラ能力）を使うか、防御側に選ばせる
        const negatingSource = await resolveNegateChoice(defender, 'opponentActivatesMagic', card, card.name, true);
        if (negatingSource) {
            // 2段階目：無効化の発動自体を、行動者側の無効化トラップでさらに打ち消せるか確認
            const counterSource = await resolveNegateChoice(player, 'opponentActivatesTrap', negatingSource, negatingSource.name, false);
            if (counterSource) {
                updateDisplay(`↩️ 「${negatingSource.name}」が「${counterSource.name}」でさらに無効化され、${card.name}の効果が発動する！`);
                await applyCardEffect(card.effectId, card.params, player, defender);
            } else {
                updateDisplay(`🚫 ${card.name} は無効化された！`);
            }
        } else {
            await applyCardEffect(card.effectId, card.params, player, defender);
        }
    }

    refreshFieldDisplay(player);
    updateHandDisplay();
    updateGraveyardDisplay(player);
    refreshAbilityDisplay();
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
    refreshAbilityDisplay();
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
    player.usedAbilitiesThisTurn = {}; // 覚醒したら能力構成が変わるため使用済み状態もリセット

    updateDisplay(`✨✨ ${getPlayerLabel(player)}のキャラクターが覚醒！「${exCard.name}」になった！`);

    refreshFieldDisplay(player);
    updateHandDisplay();
    refreshAbilityDisplay();
}

// --- キャラクター能力（① ②）の発動 ---
// 各能力は1ターンに1回まで。使用済みの能力はグレーアウトして再使用できないようにする。
// AI操作のキャラは参照用の一覧表示のみ（ボタンではない）。人間操作のキャラは、
// 自分の手番の時だけ押せるボタンとして表示する（シングルプレイ・ローカル2人対戦どちらにも対応）。

function renderCharacterAbilities(player, areaId) {
    const area = document.getElementById(areaId);
    if (!area) return;
    area.innerHTML = "";

    const baseCard = cardDatabase[player.currentCard];
    if (!baseCard || !baseCard.abilities) return;

    if (!isHumanControlled(player)) {
        area.classList.add("ability-area-readonly");
        const typeLabel = { active: '能力', triggered: '誘発', passive: '常時' };
        baseCard.abilities.forEach(ability => {
            const row = document.createElement("div");
            row.className = "ability-readonly-row";
            let text = `${typeLabel[ability.type] || ability.type}：${ability.text}`;
            if (ability.cost > 0) text += `（コスト${ability.cost}）`;
            row.innerText = text;
            area.appendChild(row);
        });
        return;
    }

    area.classList.remove("ability-area-readonly");
    const isPlayersTurn = getActivePlayer() === player;
    player.usedAbilitiesThisTurn = player.usedAbilitiesThisTurn || {};

    baseCard.abilities.forEach((ability, index) => {
        if (ability.type !== 'active') return; // passive/triggeredはボタン不要（自動判定）

        const used = !!player.usedAbilitiesThisTurn[ability.abilityId];
        const sealed = player.abilitySealedTurns > 0;
        const affordable = ability.cost <= player.od;

        const btn = document.createElement("button");
        let label = `能力：${ability.text}${ability.cost > 0 ? `（コスト${ability.cost}）` : ''}`;
        if (used) label += "（使用済み）";
        else if (!isPlayersTurn) label += "（自分のターンのみ使用可）";
        btn.innerText = label;
        btn.disabled = used || sealed || !affordable || !isPlayersTurn;
        if (used) btn.classList.add("ability-used");
        btn.onclick = () => useCharacterAbility(player, index);
        area.appendChild(btn);
    });

    if (player.abilitySealedTurns > 0) {
        const notice = document.createElement("div");
        notice.innerText = `⚠️ キャラクター能力は封印中（残り${player.abilitySealedTurns}ターン）`;
        area.appendChild(notice);
    }
}

function refreshAbilityDisplay() {
    renderCharacterAbilities(myPlayer, 'my-ability-area');
    renderCharacterAbilities(opponent, 'opponent-ability-area');
}

async function useCharacterAbility(player, abilityIndex) {
    if (gameOver) return;
    if (!isHumanControlled(player) || player !== getActivePlayer()) return; // 使えるのは自分の手番の本人のみ

    if (player.abilitySealedTurns > 0) {
        updateDisplay(`❌ キャラクター能力は現在封印されています。`);
        return;
    }

    const baseCard = cardDatabase[player.currentCard];
    const ability = baseCard && baseCard.abilities && baseCard.abilities[abilityIndex];
    if (!ability || ability.type !== 'active') return;

    player.usedAbilitiesThisTurn = player.usedAbilitiesThisTurn || {};
    if (player.usedAbilitiesThisTurn[ability.abilityId]) {
        updateDisplay(`❌ この能力は今ターン既に使用済みです。`);
        return;
    }

    if (ability.cost > player.od) {
        updateDisplay(`❌ コストが足りません（必要:${ability.cost} / 所持:${player.od}）`);
        return;
    }

    payCost(player, ability.cost);
    player.usedAbilitiesThisTurn[ability.abilityId] = true;
    updateDisplay(`💫 ${getPlayerLabel(player)}が能力発動：${ability.text}`);

    const defender = (player === myPlayer) ? opponent : myPlayer;
    await applyCardEffect(ability.effectId, ability.params, player, defender);

    await checkTrapTriggers('opponentUsesAbility', defender, player);

    refreshFieldDisplay(player);
    refreshAbilityDisplay();
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

    // 対象選択モード中で、このゾーンが選択対象になっているかどうか
    const selecting = targetSelectionState && targetSelectionState.targetPlayer === player;

    for (let i = 0; i < player.traps.length; i++) {
        const slot = document.createElement("div");
        slot.className = "trap-slot";
        const cardId = player.traps[i];

        if (!cardId) {
            slot.classList.add("trap-slot-empty");
        } else {
            const img = document.createElement("img");
            img.className = "trap-art";
            const card = cardDatabase[cardId];
            const revealed = player.trapsRevealed[i];

            // シングルプレイ（vs AI）では自分の伏せカードは常に自分に見えていて良いが、
            // ローカル2人対戦では端末を渡し合うため、持ち主の手番の時だけ見せる
            // （そうしないと相手の手番中に画面を見ただけで中身が分かってしまう）。
            const showFace = revealed || (gameMode === 'local2p' ? player === getActivePlayer() : player === myPlayer);
            if (showFace) {
                setImageWithFallback(img, getCardArtPath(card));
            } else {
                setImageWithFallback(img, CARD_BACK_IMAGE);
            }
            slot.appendChild(img);

            if (selecting && targetSelectionState.candidateIndices.includes(i)) {
                slot.classList.add("trap-slot-selectable");
                if (targetSelectionState.selected.includes(i)) slot.classList.add("trap-slot-selected");
                slot.onclick = (e) => {
                    e.stopPropagation();
                    toggleTrapTargetSelect(i);
                };
            } else {
                img.onclick = () => showCardDetail(cardId);
            }
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
