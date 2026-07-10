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

function renderDeckSelect() {
    const container = document.getElementById('deck-select-list');
    if (!container) return;
    container.innerHTML = "";

    Object.values(cardDatabase).forEach(card => {
        if (card.type !== "マジック" && card.type !== "トラップ") return;

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

        const input = document.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = String(MAX_COPIES_PER_CARD);
        input.value = deckSelection[card.id];
        input.className = "deck-qty-input";
        input.oninput = () => {
            let v = parseInt(input.value, 10);
            if (isNaN(v) || v < 0) v = 0;
            if (v > MAX_COPIES_PER_CARD) v = MAX_COPIES_PER_CARD;
            input.value = v;
            deckSelection[card.id] = v;
            updateDeckCount();
        };

        row.appendChild(img);
        row.appendChild(label);
        row.appendChild(input);
        container.appendChild(row);
    });
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
