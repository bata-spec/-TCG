// deck_builder.js - デッキ構築画面の処理

function initDeckBuilder() {
    renderCharacterSelect();
    renderDeckSelect();
    updateDeckCount();
}

function renderCharacterSelect() {
    const container = document.getElementById('character-select-list');
    if (!container) return;
    container.innerHTML = "";

    Object.values(cardDatabase).forEach(card => {
        const isCharacter = !card.type && !card.id.startsWith("EX");
        if (!isCharacter) return;

        const label = document.createElement("label");
        label.className = "character-select-option";

        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "character-select";
        radio.value = card.id;
        radio.onchange = () => {
            selectedCharacterId = card.id;
            updateGoButtonState();
        };

        const img = document.createElement("img");
        img.className = "character-select-thumb";
        setImageWithFallback(img, getCardArtPath(card));
        img.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            showCardDetail(card.id);
        };

        label.appendChild(radio);
        label.appendChild(img);
        label.append(` ${card.name}（HP:${card.hp} / コスト:${card.od}）`);
        container.appendChild(label);
    });
}

const TYPE_ORDER = ["マジック", "トラップ", "素材", "キー"];

function getSortedDeckCards() {
    const cards = Object.values(cardDatabase).filter(c => TYPE_ORDER.includes(c.type));

    switch (deckSortMode) {
        case 'effect':
            cards.sort((a, b) => {
                const ea = a.effectId || a.type;
                const eb = b.effectId || b.type;
                if (ea !== eb) return ea < eb ? -1 : 1;
                return a.cost - b.cost;
            });
            break;
        case 'cost':
            cards.sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'ja'));
            break;
        case 'name':
            cards.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
            break;
        case 'type':
        default:
            cards.sort((a, b) => {
                const ta = TYPE_ORDER.indexOf(a.type);
                const tb = TYPE_ORDER.indexOf(b.type);
                if (ta !== tb) return ta - tb;
                return a.cost - b.cost;
            });
    }
    return cards;
}

function renderDeckSelect() {
    const container = document.getElementById('deck-select-list');
    if (!container) return;
    container.innerHTML = "";

    getSortedDeckCards().forEach(card => {
        deckSelection[card.id] = deckSelection[card.id] || 0;

        const row = document.createElement("div");
        row.className = "deck-select-row";

        const img = document.createElement("img");
        img.className = "deck-select-thumb";
        setImageWithFallback(img, getCardArtPath(card));
        img.onclick = () => showCardDetail(card.id);

        const label = document.createElement("span");
        label.className = "deck-select-label";
        label.innerText = `[${card.type}] ${card.name}（コスト${card.cost}）`;
        label.onclick = () => showCardDetail(card.id);

        const stepper = document.createElement("div");
        stepper.className = "deck-qty-stepper";

        const minusBtn = document.createElement("button");
        minusBtn.className = "qty-btn";
        minusBtn.innerText = "−";
        minusBtn.onclick = () => stepCardQty(card.id, -1);

        const qtyValue = document.createElement("span");
        qtyValue.className = "qty-value";
        qtyValue.id = `qty-value-${card.id}`;
        qtyValue.innerText = deckSelection[card.id];

        const plusBtn = document.createElement("button");
        plusBtn.className = "qty-btn";
        plusBtn.innerText = "＋";
        plusBtn.onclick = () => stepCardQty(card.id, 1);

        stepper.appendChild(minusBtn);
        stepper.appendChild(qtyValue);
        stepper.appendChild(plusBtn);

        row.appendChild(img);
        row.appendChild(label);
        row.appendChild(stepper);
        container.appendChild(row);
    });
}

// +/− ボタンでの枚数変更（リスト側・詳細パネル側の両方をその場で同期）
function stepCardQty(cardId, delta) {
    let v = (deckSelection[cardId] || 0) + delta;
    if (v < 0) v = 0;
    if (v > MAX_COPIES_PER_CARD) v = MAX_COPIES_PER_CARD;
    deckSelection[cardId] = v;

    const rowValue = document.getElementById(`qty-value-${cardId}`);
    if (rowValue) rowValue.innerText = v;

    const detailValue = document.getElementById('detail-qty-value');
    if (detailValue) detailValue.innerText = v;

    updateDeckCount();
}

function getDeckTotal() {
    return Object.values(deckSelection).reduce((sum, n) => sum + n, 0);
}

function updateDeckCount() {
    const display = document.getElementById('deck-count-display');
    const total = getDeckTotal();
    if (display) display.innerText = `選択枚数: ${total}枚（${DECK_MIN}〜${DECK_MAX}枚にしてください）`;
    updateGoButtonState();
}

function updateGoButtonState() {
    const btn = document.getElementById('go-to-battle-btn');
    if (!btn) return;
    const total = getDeckTotal();
    const ok = selectedCharacterId !== null && total >= DECK_MIN && total <= DECK_MAX;
    btn.disabled = !ok;
}

function buildDeckArray() {
    const arr = [];
    Object.entries(deckSelection).forEach(([cardId, qty]) => {
        for (let i = 0; i < qty; i++) arr.push(cardId);
    });
    return arr;
}

function shuffleDeck(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

function startBattle() {
    const total = getDeckTotal();
    if (!selectedCharacterId || total < DECK_MIN || total > DECK_MAX) {
        updateDisplay(`❌ キャラクターと${DECK_MIN}〜${DECK_MAX}枚の山札を選択してください。`);
        return;
    }

    deck = buildDeckArray();
    shuffleDeck(deck);

    document.getElementById('deckbuilder-screen').style.display = "none";
    document.getElementById('battle-screen').style.display = "block";

    initBattle();
}
