# **************************************************************************** #
#  Project: Web Game (Static Site)
#  Policy:
#    - Keep src/ as source-only (no generated artifacts)
#    - Generate bundled data.js into dist/js/data.js only
# **************************************************************************** #

# ============================== Config / Paths ===============================

# Input data (source)
JSON_DIR      := assets/data

# Temporary per-json JS modules (generated; kept out of src/)
TMP_DIR       := build/tmp_data

# Source web files (source)
SRC_DIR       := src
SRC_CSS_DIR   := $(SRC_DIR)/css
SRC_JS_DIR    := $(SRC_DIR)/js
SRC_INDEX     := $(SRC_DIR)/index.html

# Deployment outputs
DIST_DIR      := dist
DIST_CSS_DIR  := $(DIST_DIR)/css
DIST_JS_DIR   := $(DIST_DIR)/js
DIST_ASSET_DIR:= $(DIST_DIR)/assets
DIST_INDEX    := $(DIST_DIR)/index.html
DATA_BUNDLE   := $(DIST_JS_DIR)/data.js

# GitHub Pages branch deploy output
PAGES_DIR     := docs

# Tools
NODE          := node

# Files
JSON_FILES    := $(wildcard $(JSON_DIR)/*.json)
TMP_JS_FILES  := $(patsubst $(JSON_DIR)/%.json,$(TMP_DIR)/%.js,$(JSON_FILES))

# ================================ Default ====================================

.PHONY: all
all: combine

# ============================ Data bundling ==================================

.PHONY: convert combine

# Convert each JSON to a JS module in TMP_DIR
convert: $(TMP_JS_FILES)

$(TMP_DIR)/%.js: $(JSON_DIR)/%.json
	@mkdir -p $(TMP_DIR)
	@name=$$(basename "$<" .json); \
	$(NODE) scripts/json2js.js "$<" "$@" "$$name"

# Combine all JS modules into dist/js/data.js (final output)
combine: convert
	@mkdir -p $(DIST_JS_DIR)
	$(NODE) scripts/combine-js.js $(TMP_JS_FILES) $(DATA_BUNDLE)

# ============================= Deployment ====================================

.PHONY: build pages

# Build dist/ as the final static site root (index.html at top-level)
# Note: build depends on combine so dist/js/data.js is ready.
build: clean-dist
	@mkdir -p $(DIST_DIR)

	$(MAKE) combine

	@cp -f $(SRC_INDEX) $(DIST_INDEX)

	@mkdir -p $(DIST_CSS_DIR)
	@cp -a $(SRC_CSS_DIR)/. $(DIST_CSS_DIR)/

	@mkdir -p $(DIST_JS_DIR)
	@cp -a $(SRC_JS_DIR)/. $(DIST_JS_DIR)/

	@mkdir -p $(DIST_ASSET_DIR)
	@cp -a assets/. $(DIST_ASSET_DIR)/

	@cp -f favicon.ico $(DIST_DIR)/favicon.ico 2>/dev/null || true
	@touch $(DIST_DIR)/.nojekyll


# For GitHub Pages "Deploy from a branch", publish docs/ (copy of dist/)
pages: build
	@rm -rf $(PAGES_DIR)
	@cp -r $(DIST_DIR) $(PAGES_DIR)

# ============================== Utilities ====================================

.PHONY: format clean clean-tmp clean-dist clean-pages

format:
	./scripts/format.sh

clean: clean-tmp clean-dist clean-pages

clean-tmp:
	@rm -rf build

clean-dist:
	@rm -rf $(DIST_DIR)

clean-pages:
	@rm -rf $(PAGES_DIR)
