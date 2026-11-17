# Open this file with Code Medic running: every function has something to fix.


def add_item(item, basket=[]):
    basket.append(item)
    return basket


def load(path):
    try:
        return open(path).read()
    except:
        print("could not read", path)
        return None


def check(value, done):
    if value == None:
        return False
    if done == True:
        return True
