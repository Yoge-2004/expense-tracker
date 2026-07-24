#!/usr/bin/env bash
# ============================================================
#  Expense Tracker — Full Test Suite Runner
#  Usage: chmod +x run-tests.sh && ./run-tests.sh
# ============================================================
set -e

BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BOLD}${CYAN}"
echo "╔══════════════════════════════════════════════════════╗"
echo "║         Expense Tracker — Test Suite Runner          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Pre-flight checks ──────────────────────────────────────
echo -e "${YELLOW}[1/4] Pre-flight checks...${NC}"
java --version || { echo -e "${RED}✗ Java not found${NC}"; exit 1; }
./mvnw --version || { echo -e "${RED}✗ Maven wrapper not found${NC}"; exit 1; }
echo -e "${GREEN}✓ Java and Maven wrapper found${NC}"
echo ""

# ── Clean ──────────────────────────────────────────────────
echo -e "${YELLOW}[2/4] Cleaning previous build...${NC}"
./mvnw clean -q
echo -e "${GREEN}✓ Clean complete${NC}"
echo ""

# ── JUnit Tests (@WebMvcTest) ─────────────────────────────
echo -e "${YELLOW}[3/4] Running JUnit unit tests (@WebMvcTest)...${NC}"
./mvnw test \
  -pl . \
  -Dtest="*Test" \
  -DfailIfNoTests=false \
  --no-transfer-progress \
  2>&1 | tee /tmp/junit-results.txt

if grep -q "BUILD SUCCESS" /tmp/junit-results.txt; then
  JUNIT_PASSED=$(grep -oP "\d+ test" /tmp/junit-results.txt | head -1)
  echo -e "${GREEN}✓ JUnit tests PASSED${NC}"
else
  echo -e "${RED}✗ JUnit tests FAILED — see output above${NC}"
  grep "FAILED\|ERROR" /tmp/junit-results.txt | head -20
  EXIT_CODE=1
fi
echo ""

# ── Cucumber Integration Tests ────────────────────────────
echo -e "${YELLOW}[4/4] Running Cucumber BDD integration tests...${NC}"
./mvnw test \
  -Dtest="CucumberTestRunner" \
  -DfailIfNoTests=false \
  --no-transfer-progress \
  2>&1 | tee /tmp/cucumber-results.txt

if grep -q "BUILD SUCCESS" /tmp/cucumber-results.txt; then
  echo -e "${GREEN}✓ Cucumber tests PASSED${NC}"
else
  echo -e "${RED}✗ Cucumber tests FAILED — see output above${NC}"
  grep "FAILED\|Undefined\|Pending\|Error" /tmp/cucumber-results.txt | head -20
  EXIT_CODE=1
fi
echo ""

# ── Summary ────────────────────────────────────────────────
echo -e "${BOLD}${CYAN}══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Test Reports${NC}"
echo -e "  JUnit   : target/surefire-reports/"
echo -e "  Cucumber: target/cucumber-reports/report.html"
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo ""

if [ -f "target/cucumber-reports/report.html" ]; then
  echo -e "${GREEN}✓ Cucumber HTML report generated.${NC}"
  echo "  Open: target/cucumber-reports/report.html"
fi

exit ${EXIT_CODE:-0}
