// utils.js - 画面表示・ダメージ処理・カード詳細表示の共通処理
// window.onerror はここでは定義しない（state.js の1箇所のみ）

function updateDisplay(message) {
    const output = document.getElementById('output');
    if (output) output.innerHTML += "<br>" + message;
}

// モードに応じてプレイヤーの呼び名を返す
function getPlayerLabel(player) {
    if (gameMode === 'local2p') {
        return player === myPlayer ? 'プレイヤー1' : 'プレイヤー2';
    }
    return player === myPlayer ? '自分' : '相手';
}

// 画像読み込み失敗時にカード裏面へフォールバックする共通ハンドラ
function setImageWithFallback(imgEl, path) {
    if (!imgEl) return;
    imgEl.onerror = () => {
        imgEl.onerror = null;
        imgEl.src = CARD_BACK_IMAGE;
    };
    imgEl.src = path;
}

function updateFieldDisplay(player, charElementId, statusElementId) {
    const charArea = document.getElementById(charElementId);
    const statusArea = document.getElementById(statusElementId);
    const artEl = document.getElementById(charElementId + "-art");
    if (!charArea || !statusArea) return;

    const originalCard = cardDatabase[player.currentCard];
    if (player.currentCard && originalCard) {
        charArea.innerText = originalCard.name;
        statusArea.innerText = `HP: ${player.hp}/${player.maxHp} / コスト: ${player.od}/${player.maxOd}`;
        if (artEl) {
            setImageWithFallback(artEl, getCardArtPath(originalCard));
            artEl.onclick = () => showCardDetail(player.currentCard);
        }
    } else {
        charArea.innerText = "召喚されていません";
        statusArea.innerText = "HP: - / コスト: -";
        if (artEl) setImageWithFallback(artEl, CARD_BACK_IMAGE);
    }
}

// player: myPlayer/opponent を渡すと自動でどちらの表示か判定して更新する
function refreshFieldDisplay(player) {
    if (player === myPlayer) {
        updateFieldDisplay(myPlayer, "my-character", "my-status");
    } else {
        updateFieldDisplay(opponent, "opponent-character", "opponent-status");
    }
}

function updateHandDisplay() {
    const handArea = document.getElementById('hand-area');
    if (!handArea) return;

    const activePlayer = getActivePlayer();
    if (!isHumanControlled(activePlayer)) {
        handArea.innerHTML = `手札: （${getPlayerLabel(activePlayer)}が操作中）`;
        return;
    }

    handArea.innerHTML = `${getPlayerLabel(activePlayer)}の手札: `;
    activePlayer.hand.forEach((cardId, index) => {
        const card = cardDatabase[cardId];
        const btn = document.createElement("button");
        btn.innerText = card ? `${card.name}[${card.type}]` : cardId;
        btn.onclick = () => confirmHandCard(index);
        handArea.appendChild(btn);
    });
}

// 手札のカードをタップした時：即使用せず、詳細と「使用する/キャンセル」を表示する
function confirmHandCard(index) {
    const player = getActivePlayer();
    const cardId = player.hand[index];
    const card = cardDatabase[cardId];
    const content = document.getElementById('card-detail-content');
    if (!card || !content) return;

    let html = `<img src="${getCardArtPath(card)}" class="detail-art" onerror="this.src='${CARD_BACK_IMAGE}'"><br>`;
    html += `<strong>${card.name}</strong>（コスト${card.cost}）<br>`;
    if (card.text) html += `${card.text}<br>`;
    if (card.flavor) html += `<em>${card.flavor}</em><br>`;
    html += `<button onclick="playHandCardConfirmed(${index})">このカードを使用する</button>`;
    html += `<button onclick="clearCardDetail()">キャンセル</button>`;
    content.innerHTML = html;
}

// 「使用する」が押された時だけ、実際にカードを使用する
function playHandCardConfirmed(index) {
    handleHandCardClick(index);
    clearCardDetail();
}

function clearCardDetail() {
    const content = document.getElementById('card-detail-content');
    if (content) content.innerHTML = "カードをタップすると詳細が表示されます";
}

function showCardDetail(cardId) {
    const card = cardDatabase[cardId];
    const content = document.getElementById('card-detail-content');
    if (!content) return;
    if (!card) {
        content.innerHTML = "カード情報が見つかりません";
        return;
    }

    let html = `<img src="${getCardArtPath(card)}" class="detail-art" onerror="this.src='${CARD_BACK_IMAGE}'"><br>`;
    html += `<strong>${card.name}</strong><br>`;
    if (card.text) html += `${card.text}<br>`;
    if (card.abilities) {
        card.abilities.forEach(a => { html += `${a.text}<br>`; });
    }
    if (card.flavor) html += `<em>${card.flavor}</em>`;
    content.innerHTML = html;
}

// 墓地の枚数・一番上のカード画像を更新する
function updateGraveyardDisplay(player) {
    const prefix = player === myPlayer ? "my" : "opponent";
    const countEl = document.getElementById(`${prefix}-graveyard-count`);
    const artEl = document.getElementById(`${prefix}-graveyard-art`);
    if (countEl) countEl.innerText = `${player.graveyard.length}`;
    if (artEl) {
        if (player.graveyard.length === 0) {
            artEl.style.visibility = "hidden";
        } else {
            artEl.style.visibility = "visible";
            const topCard = cardDatabase[player.graveyard[player.graveyard.length - 1]];
            setImageWithFallback(artEl, getCardArtPath(topCard));
            artEl.onclick = () => showCardDetail(player.graveyard[player.graveyard.length - 1]);
        }
    }
}

function applyDamage(player, damage, charElementId, statusElementId) {
    if (!player.currentCard) {
        updateDisplay("⚠️ 対象が召喚されていません！");
        return;
    }
    if (player.hp <= 0) return;

    const card = cardDatabase[player.currentCard];
    player.hp -= damage;
    updateDisplay(`${card.name} に ダメージ ${damage}！`);

    if (player.hp <= 0) {
        if (player.reflectShield > 0) {
            player.reflectShield -= 1;
            player.hp = 1;
            updateDisplay(`🛡️ 破壊無効効果で ${card.name} は破壊を免れた！`);
        } else {
            player.hp = 0;
            player.deathCount += 1;
            updateDisplay(`!!! ${card.name} 破壊（${player.deathCount}回目） !!!`);

            if (player.deathCount >= 3) {
                updateDisplay("🏁 GAME SET! 敗北です！");
            } else {
                player.hp = player.maxHp;
                player.od = player.maxOd;
                updateDisplay(`${card.name} が復活しました。HP:${player.hp}`);
            }
        }
    }

    updateFieldDisplay(player, charElementId, statusElementId);
}
