SHELL := bash
.ONESHELL:
.SHELLFLAGS := -eu -o pipefail -c
.DELETE_ON_ERROR:
.DEFAULT_GOAL := help
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rules

.PHONY: help
help: ## Prints help for targets with comments
	@echo "Targets:"
	@cat $(MAKEFILE_LIST) | grep -E '^[a-zA-Z_-]+:.*?## .*$$' | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

.PHONY: check-requirements
check-requirements: ## Ensure that all requirements are installed
	@command -v pre-commit > /dev/null 2>&1 || (echo "pre-commit not installed")

.PHONY: hooks
hooks: install-hooks ## Run pre-commit hooks on all files
	pre-commit run --color=always --all-files --hook-stage commit

.PHONY: install-hooks
install-hooks: .git/hooks/pre-commit ## Install pre-commit hooks

.git/hooks/pre-commit: .pre-commit-config.yaml
	pre-commit install

.PHONY: package
package: dist/index.js ## Package using tsup

dist/index.js: src/*.ts package.json tsconfig.json tsup.config.ts
	bun run tsup
