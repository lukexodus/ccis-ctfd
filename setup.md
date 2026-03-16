Setting up CTFd natively on Arch Linux requires pyenv for Python 3.12, a clean virtualenv, precise config.ini, and SQLite-only mode to skip Redis.

## Prerequisites
Install pyenv and build deps:
```
sudo pacman -S pyenv base-devel openssl zlib xz tk sqlite
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc
source ~/.bashrc
```

## Install Python 3.12
```
pyenv install 3.12.12
cd ~/projects/ccis_ctfd/CTFd  # Your repo
pyenv local 3.12.12
```

## Virtualenv & Dependencies
```
python -m venv ctfd-env
source ctfd-env/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

## config.ini (SQLite Dev)
```
cat > CTFd/config.ini << 'EOF'
[server]
DATABASE_URL = sqlite:///ctfd.db
REDIS_URL = 
REDIS_HOST = 
REDIS_PORT = 
REDIS_PASSWORD = 
REDIS_PROTOCOL = 
REDIS_USER = 
REDIS_DB = 

[redis]
CACHE_URL = 
EOF
```

## Database Setup
```
export FLASK_APP=CTFd
flask db init || true  # Skip if migrations/ exists
flask db migrate
flask db upgrade
```

## Launch
```
python serve.py  # http://127.0.0.1:4000
```

**Notes:** Empty Redis fields disable caching (fine for dev). Warnings like SAWarning (teams/users FK cycle) and gevent import are normal. Access localhost:4000 for admin setup. This SQLite-native flow avoids Docker network issues you encountered. 