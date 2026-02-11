#!/bin/bash

OUTPUT_FILE="/home/jose/.gemini/antigravity/brain/6500a875-ac6a-4176-89da-cef04bb9c70b/full_source_code_annotated.md"
BASE_DIR="/home/jose/Torneo de Dominó"

# Header
echo "# Cajón de Código Comentado (Torneo del Pitomate)" > "$OUTPUT_FILE"
echo "Generado para análisis con DeepSeek / LLMs externos." >> "$OUTPUT_FILE"
echo "Fecha: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Function to append file
append_file() {
    local FILE_PATH="$1"
    local TITLE="$2"
    local LANG="$3"

    echo "## $TITLE" >> "$OUTPUT_FILE"
    echo "\`\`\`$LANG" >> "$OUTPUT_FILE"
    cat "$BASE_DIR/$FILE_PATH" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "\`\`\`" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
}

# List of files to include
append_file "app/page.tsx" "1. Home Page & Guards (app/page.tsx)" "tsx"
append_file "app/setup/page.tsx" "2. Configuration & Validations (app/setup/page.tsx)" "tsx"
append_file "app/login/page.tsx" "3. Player Login & Security (app/login/page.tsx)" "tsx"
append_file "app/table-select/page.tsx" "4. Matchmaking Algorithm (app/table-select/page.tsx)" "tsx"
append_file "app/game/page.tsx" "5. Game Container & Session Hydration (app/game/page.tsx)" "tsx"
append_file "components/game/ScoreBoard.tsx" "6. Gameplay Logic & Scoring (components/game/ScoreBoard.tsx)" "tsx"
append_file "app/results/page.tsx" "7. Stats Engine & Ranking (app/results/page.tsx)" "tsx"
append_file "lib/tournamentService.ts" "8. Backend Persistence Service (lib/tournamentService.ts)" "typescript"

echo "Compilation Complete!"
