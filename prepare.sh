#!/bin/sh
# For Debian/Ubuntu:
# sudo apt-get update
# sudo DEBIAN_FRONTEND=noninteractive apt-get install -y build-essential python-dev python-pip libffi-dev

# For Arch Linux:
sudo pacman -Syu --noconfirm base-devel python python-pip python-virtualenv libffi

# Use a virtual environment for Python packages (recommended):
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# If you must install system-wide (not recommended), use:
# pip install --break-system-packages -r requirements.txt
