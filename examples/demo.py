import pandas as pd

df = pd.DataFrame({"name": ["Alice", "Bob"], "age": [30, 25]})


def setup():
    print("DataFrame loaded:")
    print(df)
