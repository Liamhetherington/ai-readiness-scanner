import time

_store = {}


def get(key):
    return _store.get(key)


def put(key, value):
    _store[key] = (time.time(), value)
