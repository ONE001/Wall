import jinja2

def format_datetime(value, format='medium'):
    if format == 'full':
        format="%d-%m-%Y %H:%M:%S"
    elif format == 'medium':
        format="%d-%m-%Y"
    return value.strftime(format)

jinja2.filters.FILTERS['format_datetime'] = format_datetime
