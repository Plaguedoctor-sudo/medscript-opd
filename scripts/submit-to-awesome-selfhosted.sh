#!/usr/bin/env bash
# MedScript OPD - Awesome-Selfhosted PR Automation Script
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGE_DIR="/tmp/awesome-selfhosted-$$"
GH_USER="Plaguedoctor-sudo"

echo "================================================================="
echo "    MEDSCRIPT OPD - AWESOME-SELFHOSTED SUBMISSION ASSISTANT"
echo "================================================================="
echo ""
echo "Cloning your fork of awesome-selfhosted into temporary staging..."

echo "Step 2: Cloning your fork..."
rm -rf "$STAGE_DIR"
git clone "git@github.com:$GH_USER/awesome-selfhosted.git" "$STAGE_DIR"
cd "$STAGE_DIR"

git checkout -b add-medscript-opd

echo "Step 3: Inserting MedScript OPD under 'Health and Fitness'..."
python3 -c "
with open('README.md', 'r') as f:
    content = f.read()

target = '- [Mere Medical]'
entry = '- [MedScript OPD](https://github.com/Plaguedoctor-sudo/medscript-opd) - Offline-first outpatient prescription and electronic medical records (EMR) system for clinics and independent physicians. \`MIT\` \`Nodejs/Docker\`\n'

if target in content and 'MedScript OPD' not in content:
    content = content.replace(target, entry + target)
    with open('README.md', 'w') as f:
        f.write(content)
    print('Inserted entry into README.md')
else:
    print('Target position checked')
"

git add README.md
git commit -m "Add MedScript OPD to Health and Fitness"

echo "Step 4: Pushing branch to your fork..."
git push -u origin add-medscript-opd

echo ""
echo "================================================================="
echo "🎉 Branch pushed! Open your Pull Request to Awesome-Selfhosted:"
echo "👉 https://github.com/awesome-selfhosted/awesome-selfhosted/compare/master...$GH_USER:add-medscript-opd?expand=1"
echo "Or visit your fork: https://github.com/$GH_USER/awesome-selfhosted/tree/add-medscript-opd"
echo "================================================================="

rm -rf "$STAGE_DIR"
