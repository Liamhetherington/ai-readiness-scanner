# weather-cli

A small command line tool that prints the forecast for a city using a public weather API. It caches results
for ten minutes so repeated calls are fast, and it can print either a short summary or a detailed hourly table.

## Installation

```
pip install -e .
```

## Usage

```
python -m weather Paris --hourly
```

Set the WEATHER_API_URL environment variable to point at a different provider. Results are cached in the
user's cache directory.
