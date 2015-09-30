if (! this.WxDashboard)
{
    this.WxDashboard = { };
}

(function ()
{
    this.WxDashboard =
    {
        // public:

        init:
            function (settings)
            {
                WxDashboard._init(settings);
            },

        // private:

        // Set with your own forecast.io API key and location.

        _FORECAST_IO_APIKEY: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',

        // private properties:

        _settings: null,            // Settings, per instance
        _timer: null,               // timeout ID of driving timer.

        // Customizable stuff:

        _TIMER_INTERVAL: 15000,     // granularity of driving timer, in ms.

        // Set with your own latitude and longitude.

        _LOCATION:
            {
                latitude: 27.466667,
                longitude: 89.461667
            },

        // Timers, their intervals, and a handler to be called when their
        // interval elapses.  When a timer fires, it will be reset.
        // To add your own timer, provide functions to manipulate the
        // codeahead however you want and call them as the timer's
        // onElapsed value.

        _timers:
            {
                // Timer for general, low-cost UI refreshes for the
                // clock and ephemeris.

                ui_timer:
                    {
                        interval: 15000,    // 15 seconds

                        onElapsed:
                            function ()
                            {
                                WxDashboard._onUITimerTick();
                            }
                    },

                // Timer for refreshes of the weather information, which
                // will trigger calls to forecast.io's api.

                wx_timer:
                    {
                        // Milliseconds between forecast.io API calls.
                        // Don't get too crazy with this; 1000 per day
                        // is all you get for free.  I've set it for 2
                        // hours between refreshes.

                        interval: 2 * 60 * 60 * 1000,

                        onElapsed:
                            function ()
                            {
                                WxDashboard._requestForecast();
                            }
                    }
            },

        // Default settings.
        _defaultSettings:
            {
                // If true, a static response will be hydrated from a
                // static JSON object and used.  Saves on your API call
                // count if you're developing.

                useStaticForecast: false,

                // Enable for debugging.

                debug: false,

                // Temperature scale.
                // 'C' for Celsius; 'F' for Fahrenheit.

                temp: 'F',

                // Length of hourly forecast, in hours.
                // forecast.io gives you 48 hours of hourly data.

                hourlyForecastLength: 16,   

                // Length of daily forecast, in (future) days.
                // forecast.io gives you 7 days of (future) daily data.

                dailyForecastLength: 5  
            },

        // End of customizable stuff.
        // private methods:

        _init:
            function (settings)
            {
                WxDashboard._settings =
                    $.extend
                    (
                        { },
                        WxDashboard._defaultSettings,
                        settings || { }
                    );

                WxDashboard._decorateImages();
                WxDashboard._initEphemeris();

                // Initialize the UI and get the timers going.

                WxDashboard._onTimerTick();
            },

        _decorateImages:
            function ()
            {
                // Images need to have a src, but I don't want to clutter up
                // the codeahead.  Note only the <img> tags in the codeahead
                // will be decorated, so we'll have to decorate any we create
                // dynamically.

                $('img').attr('src', 'images/shim.gif');
            },

        _initEphemeris:
            function ()
            {
                // Hide all but the first child in the ephemeris.  We'll
                // use that space to glide through information to save space.

                $('.TODAY_EPHEMERIS')
                    .children()
                        .hide()
                        .filter(':first')
                            .show();
            },

        _startTimer:
            function (immediate)
            {
                WxDashboard._timer =
                    window.setTimeout
                    (
                        WxDashboard._onTimerTick,
                        WxDashboard._TIMER_INTERVAL
                    );

                WxDashboard._debug
                (
                    [
                        'WxDashboard._startTimer(): started timer: ',
                        WxDashboard._timer
                    ]
                    .join('')
                );
            },

        /* Timer handler */

        _onTimerTick:
            function ()
            {
                WxDashboard._debug
                (
                    'WxDashboard._onTimerTick(): ' + new Date().toString()
                );

                // Check to see if any timers have elapsed.

                for (var key in WxDashboard._timers)
                {
                    var timer = WxDashboard._timers[key];
                    var remaining =
                        (timer._remaining || 0) - WxDashboard._TIMER_INTERVAL;

                    WxDashboard._debug
                    (
                        [
                            'WxDashboard._onTimerTick(): ',
                            'timer: ',
                            key,
                            '; remaining: ',
                            WxDashboard._formatMillis(remaining),
                            ' (',
                            remaining,
                            ' ms)'
                        ]
                        .join('')
                    );

                    // Check to see if the timer has elapsed.

                    if (remaining <= 0)
                    {
                        WxDashboard._debug
                        (
                            [
                                'WxDashboard._onTimerTick(): ',
                                'timer ',
                                key,
                                ' firing.'
                            ]
                            .join('')
                        );

                        // This timer has elapsed.
                        // Time to call its elapsed handlers.

                        if (timer.onElapsed)
                        {
                            timer.onElapsed();
                        }

                        // Reset the elapsed timer to its maximum interval.

                        timer._remaining = timer.interval;
                    }
                    else
                    {
                        // Shave a tick off the remaining time.

                        timer._remaining =
                            (timer._remaining || timer.interval)
                            - WxDashboard._TIMER_INTERVAL;
                    }
                }

                // Reset the timer to fire again in another interval.

                WxDashboard._startTimer();
            },

        /* Date/time UI Instrumentation */

        _onUITimerTick:
            function ()
            {
                WxDashboard._debug('WxDashboard._updateTimerTickUI();');

                WxDashboard._updateCurrentTime();
                WxDashboard._updateCurrentDate();
                WxDashboard._toggleEphemeris();
            },

        _updateCurrentTime:
            function ()
            {
                WxDashboard._formatTime
                (
                    new Date(),
                    $('.CURRENT_TIME')
                );
            },

        _updateCurrentDate:
            function ()
            {
                WxDashboard._formatDate
                (
                    new Date(),
                    $('.CURRENT_DATE')
                );
            },

        _toggleEphemeris:
            function ()
            {
                var $eph = $('.TODAY_EPHEMERIS');

                if ($eph.children < 2)
                {
                    // Not enough children to toggle.

                    return;
                }

                var $current = $eph.children(':visible');

                $current
                    .fadeOut
                    (
                        'slow',
                        function ()
                        {
                            var $next =
                                $(this).next().length
                                    ? $(this).next()
                                    : $(this).siblings(':first');

                            $next
                                .fadeIn
                                (
                                    'slow'
                                );
                        }
                    );
            },

        /* Weather UI instrumentation */

        _onForecastReceived:
            function (forecast)
            {
                WxDashboard._debug
                (
                    [
                        'WxDashboard._onForecastReceived(): received',
                        JSON.stringify(forecast).length,
                        'chars of JSON forecast data.'
                    ]
                    .join(' ')
                );

                WxDashboard._setStatus
                (
                    [
                        'Forecast updated ',
                        WxDashboard._formatDate
                        (
                            new Date(),
                            null,
                            {
                                month: 'numeric',
                                day: 'numeric',
                                year: 'numeric'
                            }
                        ),
                        ' ',
                        WxDashboard._formatTime
                        (
                            new Date(),
                            null,
                            {
                                hour: 'numeric',
                                minute: 'numeric'
                            }
                        ),
                        '.'
                    ]
                    .join('')
                );

                WxDashboard._updateCurrentWeather(forecast);
                WxDashboard._updateSunriseSunset(forecast);
                WxDashboard._updateMoonPhase(forecast);
                WxDashboard._updateHourlyForecast(forecast);
                WxDashboard._updateDailyForecast(forecast);
            },

        _updateCurrentWeather:
            function (forecast)
            {
                var current = forecast.currently;

                $('.CURRENT_ICON')
                    .attr('class', '')
                    .addClass
                    (
                        [
                            'CURRENT_ICON',
                            WxDashboard._getForecastIcon(current.icon)
                        ]
                        .join(' ')
                    );

                $('.CURRENT_TEMP')
                    .html
                    (
                        WxDashboard._formatTemp
                        (
                            current.apparentTemperature,
                            {
                                digits: 0
                            }
                        )
                    );

                $('.CURRENT_SUMMARY').text(current.summary);
            },

        _updateMoonPhase:
            function (forecast)
            {
                var dailyData = forecast.daily.data[0];

                $('.LUNATION')
                    .text
                    (
                        [
                            parseInt(dailyData.moonPhase * 100),
                            '%'
                        ]
                        .join('')
                    );
            },

        _updateSunriseSunset:
            function (forecast)
            {
                var today = forecast.daily.data[0];
                
                // Forecast's sunrise and sunset are measured in seconds.

                var sunrise = new Date(today.sunriseTime * 1000);
                var sunset = new Date(today.sunsetTime * 1000);

                WxDashboard._formatTime(sunrise, $('.SUNRISE'));
                WxDashboard._formatTime(sunset, $('.SUNSET'));
            },

        _updateHourlyForecast:
            function (forecast)
            {
                var today = forecast.daily.data[0];
                var hourly = forecast.hourly;
                var summary = hourly.summary;

                // Set today's forecast.

                $('.TODAY_SUMMARY').text(summary);

                $('.TODAY_TEMPS')
                    .html
                    (
                        [
                            WxDashboard._formatTemp
                            (
                                today.apparentTemperatureMax,
                                { digits: 0, showTemp: false }
                            ),
                            '/',
                            WxDashboard._formatTemp
                            (
                                today.apparentTemperatureMin,
                                { digits: 0, showTemp: false }
                            )
                        ]
                        .join('')
                    );
                
                // Check today's precipitation.

                WxDashboard._checkPrecipitation
                (
                    forecast.currently,
                    $('.TODAY_PRECIP')
                );

                // Clear current hourly forecast.

                $('.HOURLY_FORECAST')
                    .find('td:visible')
                        .remove();

                // Reconstruct hourly forecast.
                // Skip every other hour for terseness.

                for (var i = 0;
                     i < Math.min(hourly.data.length,
                                  WxDashboard._settings.hourlyForecastLength);
                     i += 2)
                {
                    var hourlyData = hourly.data[i];

                    var $clone =
                        $('.HOURLY_TEMPLATE:not(:visible)')
                            .clone();

                    WxDashboard._addHourlyForecast(hourlyData, $clone);
                }
            },

        _addHourlyForecast:
            function (hourlyData, $target)
            {
                // Set hourly icon and temperature.

                $target
                    .find('.HOURLY_ICON')
                        .attr('src', 'images/shim.gif')
                        .addClass
                        (
                             WxDashboard._getForecastIcon(hourlyData.icon)
                        )
                        .end()
                    .find('.HOURLY_TEMP')
                        .html
                        (
                            WxDashboard._formatTemp
                            (
                                hourlyData.apparentTemperature,
                                {
                                    digits: 0,
                                    showTemp: false
                                }
                            )
                        );

                // Set forecast time.

                WxDashboard._formatTime
                (
                    new Date(hourlyData.time * 1000),
                    $target.find('.HOURLY_TIME'),
                    {
                        hour: '2-digit'
                    }
                );

                // Set precipitation probability, if it's nonzero.

                if (hourlyData.precipProbability > 0)
                {
                    $target
                        .find('.HOURLY_PRECIP')
                            .text
                            (
                                [
                                    hourlyData.precipProbability * 100,
                                    '%'
                                ]
                                .join('')
                            );
                }

                $('.HOURLY_FORECAST tr')
                    .append
                    (
                        $target.show()
                    );
            },

        _updateDailyForecast:
            function (forecast)
            {
                var daily = forecast.daily;

                $('.DAILY_FORECAST')
                    .children(':visible')
                        .remove();

                // Skip the first daily forecast, which is for today.

                for (var i = 1;
                     i < Math.min(daily.data.length,
                                  1 + WxDashboard._settings.dailyForecastLength);
                     i++)
                {
                    var dailyData = daily.data[i];

                    var $clone =
                        $('.DAILY_TEMPLATE:not(:visible)')
                            .clone();

                    WxDashboard._addDailyForecast(dailyData, $clone);
                }
            },
            
        _addDailyForecast:
            function (dailyData, $target)
            {
                $target
                    .find('.DAILY_ICON')
                        .addClass(WxDashboard._getForecastIcon(dailyData.icon))
                        .end()
                    .find('.DAILY_TEXT')
                        .html
                        (
                            WxDashboard._getDailyForecastText(dailyData)
                        )
                        .end()
                    .find('.DAILY_TEMPS')
                        .html
                        (
                            [
                                WxDashboard._formatTemp
                                (
                                    dailyData.apparentTemperatureMax,
                                    { digits: 0, showTemp: false }
                                ),
                                '/',
                                WxDashboard._formatTemp
                                (
                                    dailyData.apparentTemperatureMin,
                                    { digits: 0, showTemp: false }
                                )
                            ]
                            .join('')
                        );

                WxDashboard._checkPrecipitation
                (
                    dailyData,
                    $target.find('.DAILY_PRECIP')
                );

                $('.DAILY_FORECAST')
                    .append
                    (
                        $target.show()
                    );
            },

        _getDailyForecastText:
            function (dailyData)
            {
                var date = new Date(dailyData.time * 1000);
                var text = [ ];

                // Day of week and forecast summary.

                Array.prototype.push.apply
                (
                    text,
                    [
                        WxDashboard._getWeekdayName(date),
                        ': ',
                        dailyData.summary,
                        ' '
                    ]
                );

                return text.join('');
            },

        _checkPrecipitation:
            function (data, $target)
            {
                // If precipitation ...

                if (data.precipProbability > 0)
                {
                    // Configure and show the precipitation container.

                    $target
                        .find('.PRECIP_ICON')
                            .addClass(data.precipType || 'rain')
                            .end()
                        .find('.PRECIP_CHANCE')
                            .text
                            (
                                [
                                    (data.precipProbability * 100).toFixed(0),
                                    '%. '
                                ]
                                .join('')
                            )
                            .end()
                        .show();
                }
            },

        /* Utilities */

        _formatDate:
            function (date, $target, props)
            {
                // Set default properties.

                props =
                    $.extend
                    (
                        { },
                        props || 
                            {
                                weekday: 'long',
                                month: 'long',
                                day: '2-digit'
                            }
                    );

                var text = 
                    date.toLocaleDateString
                    (
                        navigator.language,
                        props
                    );

                if ($target)
                {
                    $target.text(text);
                }

                return text;
            },

        _getWeekdayName:
            function (date)
            {
                return date.toLocaleString
                    (
                        navigator.language,
                        {
                            weekday: 'long'
                        }
                    );
            },

        _formatTime:
            function (date, $target, props)
            {
                // Set default properties.

                props =
                    $.extend
                    (
                        { },
                        props || 
                            {
                                hour: '2-digit',
                                minute: '2-digit'
                            }
                    );

                var text = 
                    date.toLocaleTimeString
                    (
                        navigator.language,
                        props
                    );

                if ($target)
                {
                    $target.text(text);
                }

                return text;
            },

        _formatTemp:
            function (f, props)
            {
                // Forecast.IO returns temperatures in F by default,
                // so we'll also use that as the default scale.

                props =
                    $.extend
                    (
                        {
                            digits: 1,
                            temp: WxDashboard._settings.temp,
                            showTemp: true
                        },
                        props || { }
                    );

                var temp;

                switch (props.temp)
                {
                    case 'F':
                    default:
                        temp = f;
                        break;

                    case 'C':
                        temp = (5 / 9) * (f - 32);
                        break;
                }

                return [
                        temp.toFixed(props.digits),
                        '&deg;',
                        props.showTemp ? props.temp : ''
                    ]
                    .join('');
            },

        _getForecastIcon:
            function (icon)
            {
                switch (icon)
                {
                    case 'clear-day':
                    case 'clear-night':
                    case 'rain':
                    case 'snow':
                    case 'sleet':
                    case 'hail':
                    case 'wind':
                    case 'fog':
                    case 'cloudy':
                    case 'partly-cloudy-day':
                    case 'partly-cloudy-night':
                        return icon;

                    default:
                        return 'UNKNOWN';
                }
            },

        _debug:
            function (message)
            {
                if (WxDashboard._settings.debug)
                {
                    console.log(message);
                }
            },

        _requestForecast:
            function ()
            {
                WxDashboard._debug('WxDashboard._requestForecast();');

                // If we're using the static forecast, just return one
                // from the debugging function.  Saves on API calls when
                // developing.

                if (WxDashboard._settings.useStaticForecast)
                {
                    WxDashboard._debug
                    (
                        [
                            'WxDashboard._requestForecast():',
                            'using static forecast.'
                        ]
                        .join(' ')
                    );

                    WxDashboard._onForecastReceived
                    (
                        WxDashboard._getStaticForecast()
                    );

                    return;
                }

                // Since we're targeting older hardware with browsers that
                // may not support CORS, we'll use JSONP to avoid running
                // afoul of the same-origin policy.  Be sure to do
                // due-diligence and use caution when doing this in general,
                // but for our purposes as a personal/internal-use kind of
                // application, it's convenient.

                var url = 
                    [
                        'https://api.forecast.io/forecast/',
                        WxDashboard._FORECAST_IO_APIKEY,
                        '/',
                        WxDashboard._LOCATION.latitude,
                        ',',
                        WxDashboard._LOCATION.longitude,
                        '?callback=?'
                    ]
                    .join('');

                WxDashboard._debug
                (
                    'WxDashboard._requestForecast(): url: ' + url
                );

                $.getJSON(url)
                    .done
                    (
                        function (data)
                        {
                            WxDashboard._debug
                            (
                                'WxDashboard._requestForecast(): success.'
                            );

                            WxDashboard._onForecastReceived(data);
                        }
                    )
                    .fail
                    (
                        function (_, textStatus, errorThrown)
                        {
                            WxDashboard._debug
                            (
                                [
                                    'WxDashboard._requestForecast(): fail:',
                                    'textstatus:', textStatus,
                                    'errorThrown:', errorThrown
                                ]
                                .join(' ')
                            );

                            // Set the status bar message and indicate
                            // an error.

                            WxDashboard._setStatus
                            (
                                [
                                    'Error requesting forecast:',
                                    errorThrown
                                ]
                                .join(' '),
                                {
                                    isError: true
                                }
                            );
                        }
                    );
            },

        _setStatus:
            function (message, props)
            {
                props =
                    $.extend
                    (
                        { },
                        {
                            isError: false
                        },
                        props || { }
                    );

                $('.STATUS')
                    .text(message)
                    .toggleClass('ERROR', props.isError);
            },

        _formatMillis:
            function (millis)
            {
                // Format the milliseconds into something more
                // human-friendly.

                millis = Math.abs(millis);

                return [
                    Math.floor
                    (
                        millis / (60 * 60 * 1000)
                    ),
                    'h ',
                    Math.floor
                    (
                        millis / (60 * 1000)
                    ) % 60,
                    'm ',
                    Math.floor
                    (
                        millis / 1000
                    ) % 60,
                    '.',
                    Math.floor
                    (
                        millis % 1000
                    ),
                    's'
                ]
                .join('');
            },

        _getStaticForecast:
            function ()
            {
                return {
                    "latitude" : 27.466667,
                    "longitude" : 89.641667,
                    "timezone" : "Asia/Thimphu",
                    "offset" : 6,
                    "currently" : {
                        "time" : 1443582012,
                        "summary" : "Clear",
                        "icon" : "clear-day",
                        "precipIntensity" : 0,
                        "precipProbability" : 0,
                        "temperature" : 58.63,
                        "apparentTemperature" : 58.63,
                        "dewPoint" : 48.26,
                        "humidity" : 0.68,
                        "windSpeed" : 3,
                        "windBearing" : 141,
                        "cloudCover" : 0.11,
                        "pressure" : 1017.46,
                        "ozone" : 251.95
                    },
                    "hourly" : {
                        "summary" : "Clear throughout the day.",
                        "icon" : "clear-day",
                        "data" : [{
                                "time" : 1443582000,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 58.62,
                                "apparentTemperature" : 58.62,
                                "dewPoint" : 48.28,
                                "humidity" : 0.68,
                                "windSpeed" : 2.99,
                                "windBearing" : 141,
                                "cloudCover" : 0.11,
                                "pressure" : 1017.47,
                                "ozone" : 251.95
                            }, {
                                "time" : 1443585600,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 60.91,
                                "apparentTemperature" : 60.91,
                                "dewPoint" : 41.94,
                                "humidity" : 0.5,
                                "windSpeed" : 4.14,
                                "windBearing" : 152,
                                "cloudCover" : 0.04,
                                "pressure" : 1016.99,
                                "ozone" : 251.66
                            }, {
                                "time" : 1443589200,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 62.76,
                                "apparentTemperature" : 62.76,
                                "dewPoint" : 42.53,
                                "humidity" : 0.48,
                                "windSpeed" : 5.43,
                                "windBearing" : 160,
                                "cloudCover" : 0.04,
                                "pressure" : 1016.28,
                                "ozone" : 251.37
                            }, {
                                "time" : 1443592800,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 64.45,
                                "apparentTemperature" : 64.45,
                                "dewPoint" : 43.98,
                                "humidity" : 0.47,
                                "windSpeed" : 6.31,
                                "windBearing" : 164,
                                "cloudCover" : 0.05,
                                "pressure" : 1015.55,
                                "ozone" : 251.17
                            }, {
                                "time" : 1443596400,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 65.71,
                                "apparentTemperature" : 65.71,
                                "dewPoint" : 46.1,
                                "humidity" : 0.49,
                                "windSpeed" : 6.49,
                                "windBearing" : 166,
                                "cloudCover" : 0.06,
                                "pressure" : 1014.72,
                                "ozone" : 251.15
                            }, {
                                "time" : 1443600000,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0.0008,
                                "precipProbability" : 0.01,
                                "precipType" : "rain",
                                "temperature" : 65.05,
                                "apparentTemperature" : 65.05,
                                "dewPoint" : 47.36,
                                "humidity" : 0.53,
                                "windSpeed" : 6.23,
                                "windBearing" : 167,
                                "cloudCover" : 0.08,
                                "pressure" : 1013.83,
                                "ozone" : 251.21
                            }, {
                                "time" : 1443603600,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0.001,
                                "precipProbability" : 0.01,
                                "precipType" : "rain",
                                "temperature" : 63.8,
                                "apparentTemperature" : 63.8,
                                "dewPoint" : 48.3,
                                "humidity" : 0.57,
                                "windSpeed" : 5.83,
                                "windBearing" : 167,
                                "cloudCover" : 0.09,
                                "pressure" : 1013.23,
                                "ozone" : 251.19
                            }, {
                                "time" : 1443607200,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0.0011,
                                "precipProbability" : 0.01,
                                "precipType" : "rain",
                                "temperature" : 61.88,
                                "apparentTemperature" : 61.88,
                                "dewPoint" : 48.93,
                                "humidity" : 0.62,
                                "windSpeed" : 5.36,
                                "windBearing" : 163,
                                "cloudCover" : 0.11,
                                "pressure" : 1013.11,
                                "ozone" : 251.01
                            }, {
                                "time" : 1443610800,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0.001,
                                "precipProbability" : 0.01,
                                "precipType" : "rain",
                                "temperature" : 59.62,
                                "apparentTemperature" : 59.62,
                                "dewPoint" : 49.28,
                                "humidity" : 0.69,
                                "windSpeed" : 4.8,
                                "windBearing" : 157,
                                "cloudCover" : 0.12,
                                "pressure" : 1013.31,
                                "ozone" : 250.74
                            }, {
                                "time" : 1443614400,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0.0009,
                                "precipProbability" : 0.01,
                                "precipType" : "rain",
                                "temperature" : 57.74,
                                "apparentTemperature" : 57.74,
                                "dewPoint" : 49.41,
                                "humidity" : 0.74,
                                "windSpeed" : 4.15,
                                "windBearing" : 151,
                                "cloudCover" : 0.13,
                                "pressure" : 1013.73,
                                "ozone" : 250.44
                            }, {
                                "time" : 1443618000,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 56.52,
                                "apparentTemperature" : 56.52,
                                "dewPoint" : 49.55,
                                "humidity" : 0.77,
                                "windSpeed" : 3.26,
                                "windBearing" : 150,
                                "cloudCover" : 0.14,
                                "pressure" : 1014.49,
                                "ozone" : 250.1
                            }, {
                                "time" : 1443621600,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 55.61,
                                "apparentTemperature" : 55.61,
                                "dewPoint" : 49.67,
                                "humidity" : 0.8,
                                "windSpeed" : 2.21,
                                "windBearing" : 151,
                                "cloudCover" : 0.15,
                                "pressure" : 1015.51,
                                "ozone" : 249.72
                            }, {
                                "time" : 1443625200,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 54.78,
                                "apparentTemperature" : 54.78,
                                "dewPoint" : 49.62,
                                "humidity" : 0.83,
                                "windSpeed" : 1.29,
                                "windBearing" : 150,
                                "cloudCover" : 0.16,
                                "pressure" : 1016.35,
                                "ozone" : 249.38
                            }, {
                                "time" : 1443628800,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 53.97,
                                "apparentTemperature" : 53.97,
                                "dewPoint" : 49.29,
                                "humidity" : 0.84,
                                "windSpeed" : 0.66,
                                "windBearing" : 129,
                                "cloudCover" : 0.17,
                                "pressure" : 1016.8,
                                "ozone" : 249.05
                            }, {
                                "time" : 1443632400,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 53.17,
                                "apparentTemperature" : 53.17,
                                "dewPoint" : 48.73,
                                "humidity" : 0.85,
                                "windSpeed" : 0.55,
                                "windBearing" : 70,
                                "cloudCover" : 0.16,
                                "pressure" : 1016.97,
                                "ozone" : 248.76
                            }, {
                                "time" : 1443636000,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 52.29,
                                "apparentTemperature" : 52.29,
                                "dewPoint" : 47.99,
                                "humidity" : 0.85,
                                "windSpeed" : 0.79,
                                "windBearing" : 44,
                                "cloudCover" : 0.16,
                                "pressure" : 1017,
                                "ozone" : 248.63
                            }, {
                                "time" : 1443639600,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 51.17,
                                "apparentTemperature" : 51.17,
                                "dewPoint" : 46.98,
                                "humidity" : 0.86,
                                "windSpeed" : 0.89,
                                "windBearing" : 44,
                                "cloudCover" : 0.14,
                                "pressure" : 1016.92,
                                "ozone" : 248.77
                            }, {
                                "time" : 1443643200,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 49.9,
                                "apparentTemperature" : 49.9,
                                "dewPoint" : 45.76,
                                "humidity" : 0.86,
                                "windSpeed" : 0.88,
                                "windBearing" : 55,
                                "cloudCover" : 0.11,
                                "pressure" : 1016.75,
                                "ozone" : 249.07
                            }, {
                                "time" : 1443646800,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 48.74,
                                "apparentTemperature" : 48.74,
                                "dewPoint" : 44.58,
                                "humidity" : 0.85,
                                "windSpeed" : 0.82,
                                "windBearing" : 64,
                                "cloudCover" : 0.1,
                                "pressure" : 1016.65,
                                "ozone" : 249.4
                            }, {
                                "time" : 1443650400,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 47.57,
                                "apparentTemperature" : 47.57,
                                "dewPoint" : 43.56,
                                "humidity" : 0.86,
                                "windSpeed" : 0.63,
                                "windBearing" : 53,
                                "cloudCover" : 0.1,
                                "pressure" : 1016.74,
                                "ozone" : 249.75
                            }, {
                                "time" : 1443654000,
                                "summary" : "Clear",
                                "icon" : "clear-night",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 46.69,
                                "apparentTemperature" : 46.69,
                                "dewPoint" : 42.76,
                                "humidity" : 0.86,
                                "windSpeed" : 0.42,
                                "windBearing" : 25,
                                "cloudCover" : 0.12,
                                "pressure" : 1016.92,
                                "ozone" : 250.13
                            }, {
                                "time" : 1443657600,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 47.88,
                                "apparentTemperature" : 47.88,
                                "dewPoint" : 43.23,
                                "humidity" : 0.84,
                                "windSpeed" : 0.15,
                                "windBearing" : 53,
                                "cloudCover" : 0.13,
                                "pressure" : 1017.16,
                                "ozone" : 250.39
                            }, {
                                "time" : 1443661200,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 50.87,
                                "apparentTemperature" : 50.87,
                                "dewPoint" : 43.9,
                                "humidity" : 0.77,
                                "windSpeed" : 0.93,
                                "windBearing" : 138,
                                "cloudCover" : 0.12,
                                "pressure" : 1017.53,
                                "ozone" : 250.46
                            }, {
                                "time" : 1443664800,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 54.6,
                                "apparentTemperature" : 54.6,
                                "dewPoint" : 44.04,
                                "humidity" : 0.67,
                                "windSpeed" : 2.27,
                                "windBearing" : 142,
                                "cloudCover" : 0.1,
                                "pressure" : 1017.92,
                                "ozone" : 250.41
                            }, {
                                "time" : 1443668400,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 57.74,
                                "apparentTemperature" : 57.74,
                                "dewPoint" : 43.81,
                                "humidity" : 0.6,
                                "windSpeed" : 3.48,
                                "windBearing" : 147,
                                "cloudCover" : 0.09,
                                "pressure" : 1017.99,
                                "ozone" : 250.27
                            }, {
                                "time" : 1443672000,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 60.16,
                                "apparentTemperature" : 60.16,
                                "dewPoint" : 44.12,
                                "humidity" : 0.55,
                                "windSpeed" : 4.49,
                                "windBearing" : 155,
                                "cloudCover" : 0.08,
                                "pressure" : 1017.56,
                                "ozone" : 250.01
                            }, {
                                "time" : 1443675600,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 62.56,
                                "apparentTemperature" : 62.56,
                                "dewPoint" : 45.3,
                                "humidity" : 0.53,
                                "windSpeed" : 5.47,
                                "windBearing" : 162,
                                "cloudCover" : 0.07,
                                "pressure" : 1016.83,
                                "ozone" : 249.65
                            }, {
                                "time" : 1443679200,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0,
                                "precipProbability" : 0,
                                "temperature" : 64.65,
                                "apparentTemperature" : 64.65,
                                "dewPoint" : 46.98,
                                "humidity" : 0.53,
                                "windSpeed" : 6.15,
                                "windBearing" : 167,
                                "cloudCover" : 0.09,
                                "pressure" : 1016.05,
                                "ozone" : 249.34
                            }, {
                                "time" : 1443682800,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0.0008,
                                "precipProbability" : 0.01,
                                "precipType" : "rain",
                                "temperature" : 65.76,
                                "apparentTemperature" : 65.76,
                                "dewPoint" : 48.58,
                                "humidity" : 0.54,
                                "windSpeed" : 6.35,
                                "windBearing" : 170,
                                "cloudCover" : 0.14,
                                "pressure" : 1015.12,
                                "ozone" : 249.09
                            }, {
                                "time" : 1443686400,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0.0011,
                                "precipProbability" : 0.01,
                                "precipType" : "rain",
                                "temperature" : 64.93,
                                "apparentTemperature" : 64.93,
                                "dewPoint" : 49.15,
                                "humidity" : 0.57,
                                "windSpeed" : 6.23,
                                "windBearing" : 174,
                                "cloudCover" : 0.22,
                                "pressure" : 1014.07,
                                "ozone" : 248.88
                            }, {
                                "time" : 1443690000,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-day",
                                "precipIntensity" : 0.0014,
                                "precipProbability" : 0.02,
                                "precipType" : "rain",
                                "temperature" : 63.46,
                                "apparentTemperature" : 63.46,
                                "dewPoint" : 49.49,
                                "humidity" : 0.6,
                                "windSpeed" : 5.97,
                                "windBearing" : 175,
                                "cloudCover" : 0.28,
                                "pressure" : 1013.31,
                                "ozone" : 248.79
                            }, {
                                "time" : 1443693600,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-day",
                                "precipIntensity" : 0.0016,
                                "precipProbability" : 0.03,
                                "precipType" : "rain",
                                "temperature" : 61.34,
                                "apparentTemperature" : 61.34,
                                "dewPoint" : 49.6,
                                "humidity" : 0.65,
                                "windSpeed" : 5.54,
                                "windBearing" : 173,
                                "cloudCover" : 0.3,
                                "pressure" : 1013.04,
                                "ozone" : 248.89
                            }, {
                                "time" : 1443697200,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-day",
                                "precipIntensity" : 0.0017,
                                "precipProbability" : 0.03,
                                "precipType" : "rain",
                                "temperature" : 58.89,
                                "apparentTemperature" : 58.89,
                                "dewPoint" : 49.5,
                                "humidity" : 0.71,
                                "windSpeed" : 4.98,
                                "windBearing" : 168,
                                "cloudCover" : 0.3,
                                "pressure" : 1013.1,
                                "ozone" : 249.12
                            }, {
                                "time" : 1443700800,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0017,
                                "precipProbability" : 0.03,
                                "precipType" : "rain",
                                "temperature" : 56.85,
                                "apparentTemperature" : 56.85,
                                "dewPoint" : 49.32,
                                "humidity" : 0.76,
                                "windSpeed" : 4.5,
                                "windBearing" : 163,
                                "cloudCover" : 0.3,
                                "pressure" : 1013.42,
                                "ozone" : 249.29
                            }, {
                                "time" : 1443704400,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0018,
                                "precipProbability" : 0.03,
                                "precipType" : "rain",
                                "temperature" : 55.51,
                                "apparentTemperature" : 55.51,
                                "dewPoint" : 49.29,
                                "humidity" : 0.8,
                                "windSpeed" : 4.17,
                                "windBearing" : 161,
                                "cloudCover" : 0.32,
                                "pressure" : 1014.18,
                                "ozone" : 249.34
                            }, {
                                "time" : 1443708000,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0019,
                                "precipProbability" : 0.04,
                                "precipType" : "rain",
                                "temperature" : 54.55,
                                "apparentTemperature" : 54.55,
                                "dewPoint" : 49.36,
                                "humidity" : 0.83,
                                "windSpeed" : 3.87,
                                "windBearing" : 159,
                                "cloudCover" : 0.33,
                                "pressure" : 1015.27,
                                "ozone" : 249.34
                            }, {
                                "time" : 1443711600,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0019,
                                "precipProbability" : 0.04,
                                "precipType" : "rain",
                                "temperature" : 53.76,
                                "apparentTemperature" : 53.76,
                                "dewPoint" : 49.34,
                                "humidity" : 0.85,
                                "windSpeed" : 3.42,
                                "windBearing" : 158,
                                "cloudCover" : 0.34,
                                "pressure" : 1016.21,
                                "ozone" : 249.34
                            }, {
                                "time" : 1443715200,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0018,
                                "precipProbability" : 0.03,
                                "precipType" : "rain",
                                "temperature" : 53.06,
                                "apparentTemperature" : 53.06,
                                "dewPoint" : 49.13,
                                "humidity" : 0.86,
                                "windSpeed" : 2.64,
                                "windBearing" : 158,
                                "cloudCover" : 0.35,
                                "pressure" : 1016.74,
                                "ozone" : 249.32
                            }, {
                                "time" : 1443718800,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0016,
                                "precipProbability" : 0.03,
                                "precipType" : "rain",
                                "temperature" : 52.44,
                                "apparentTemperature" : 52.44,
                                "dewPoint" : 48.75,
                                "humidity" : 0.87,
                                "windSpeed" : 1.73,
                                "windBearing" : 160,
                                "cloudCover" : 0.37,
                                "pressure" : 1016.97,
                                "ozone" : 249.29
                            }, {
                                "time" : 1443722400,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0015,
                                "precipProbability" : 0.02,
                                "precipType" : "rain",
                                "temperature" : 51.77,
                                "apparentTemperature" : 51.77,
                                "dewPoint" : 48.24,
                                "humidity" : 0.88,
                                "windSpeed" : 1.09,
                                "windBearing" : 164,
                                "cloudCover" : 0.37,
                                "pressure" : 1016.98,
                                "ozone" : 249.36
                            }, {
                                "time" : 1443726000,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0015,
                                "precipProbability" : 0.02,
                                "precipType" : "rain",
                                "temperature" : 50.9,
                                "apparentTemperature" : 50.9,
                                "dewPoint" : 47.5,
                                "humidity" : 0.88,
                                "windSpeed" : 0.98,
                                "windBearing" : 172,
                                "cloudCover" : 0.37,
                                "pressure" : 1016.77,
                                "ozone" : 249.6
                            }, {
                                "time" : 1443729600,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0015,
                                "precipProbability" : 0.02,
                                "precipType" : "rain",
                                "temperature" : 49.88,
                                "apparentTemperature" : 49.88,
                                "dewPoint" : 46.57,
                                "humidity" : 0.88,
                                "windSpeed" : 1.14,
                                "windBearing" : 178,
                                "cloudCover" : 0.36,
                                "pressure" : 1016.44,
                                "ozone" : 249.93
                            }, {
                                "time" : 1443733200,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0014,
                                "precipProbability" : 0.02,
                                "precipType" : "rain",
                                "temperature" : 48.93,
                                "apparentTemperature" : 48.93,
                                "dewPoint" : 45.72,
                                "humidity" : 0.89,
                                "windSpeed" : 1.17,
                                "windBearing" : 180,
                                "cloudCover" : 0.34,
                                "pressure" : 1016.18,
                                "ozone" : 250.24
                            }, {
                                "time" : 1443736800,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0014,
                                "precipProbability" : 0.02,
                                "precipType" : "rain",
                                "temperature" : 47.99,
                                "apparentTemperature" : 47.99,
                                "dewPoint" : 45.18,
                                "humidity" : 0.9,
                                "windSpeed" : 0.8,
                                "windBearing" : 182,
                                "cloudCover" : 0.34,
                                "pressure" : 1016.11,
                                "ozone" : 250.47
                            }, {
                                "time" : 1443740400,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-night",
                                "precipIntensity" : 0.0013,
                                "precipProbability" : 0.02,
                                "precipType" : "rain",
                                "temperature" : 47.27,
                                "apparentTemperature" : 47.27,
                                "dewPoint" : 44.87,
                                "humidity" : 0.91,
                                "windSpeed" : 0.31,
                                "windBearing" : 182,
                                "cloudCover" : 0.33,
                                "pressure" : 1016.13,
                                "ozone" : 250.67
                            }, {
                                "time" : 1443744000,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-day",
                                "precipIntensity" : 0.0012,
                                "precipProbability" : 0.02,
                                "precipType" : "rain",
                                "temperature" : 48.2,
                                "apparentTemperature" : 48.2,
                                "dewPoint" : 45.44,
                                "humidity" : 0.9,
                                "windSpeed" : 0.28,
                                "windBearing" : 138,
                                "cloudCover" : 0.31,
                                "pressure" : 1016.19,
                                "ozone" : 250.89
                            }, {
                                "time" : 1443747600,
                                "summary" : "Partly Cloudy",
                                "icon" : "partly-cloudy-day",
                                "precipIntensity" : 0.0012,
                                "precipProbability" : 0.02,
                                "precipType" : "rain",
                                "temperature" : 50.33,
                                "apparentTemperature" : 50.33,
                                "dewPoint" : 45.65,
                                "humidity" : 0.84,
                                "windSpeed" : 1.08,
                                "windBearing" : 134,
                                "cloudCover" : 0.27,
                                "pressure" : 1016.33,
                                "ozone" : 251.18
                            }, {
                                "time" : 1443751200,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0.0011,
                                "precipProbability" : 0.01,
                                "precipType" : "rain",
                                "temperature" : 52.95,
                                "apparentTemperature" : 52.95,
                                "dewPoint" : 45.23,
                                "humidity" : 0.75,
                                "windSpeed" : 2.29,
                                "windBearing" : 138,
                                "cloudCover" : 0.21,
                                "pressure" : 1016.46,
                                "ozone" : 251.48
                            }, {
                                "time" : 1443754800,
                                "summary" : "Clear",
                                "icon" : "clear-day",
                                "precipIntensity" : 0.0011,
                                "precipProbability" : 0.01,
                                "precipType" : "rain",
                                "temperature" : 55.29,
                                "apparentTemperature" : 55.29,
                                "dewPoint" : 44.71,
                                "humidity" : 0.67,
                                "windSpeed" : 3.35,
                                "windBearing" : 143,
                                "cloudCover" : 0.17,
                                "pressure" : 1016.3,
                                "ozone" : 251.65
                            }
                        ]
                    },
                    "daily" : {
                        "summary" : "Drizzle on Saturday, with temperatures falling to 59°F on Sunday.",
                        "icon" : "rain",
                        "data" : [{
                                "time" : 1443549600,
                                "summary" : "Clear throughout the day.",
                                "icon" : "clear-day",
                                "sunriseTime" : 1443570870,
                                "sunsetTime" : 1443613875,
                                "moonPhase" : 0.58,
                                "precipIntensity" : 0.0004,
                                "precipIntensityMax" : 0.0011,
                                "precipIntensityMaxTime" : 1443607200,
                                "precipProbability" : 0.01,
                                "precipType" : "rain",
                                "temperatureMin" : 44.63,
                                "temperatureMinTime" : 1443571200,
                                "temperatureMax" : 65.71,
                                "temperatureMaxTime" : 1443596400,
                                "apparentTemperatureMin" : 44.63,
                                "apparentTemperatureMinTime" : 1443571200,
                                "apparentTemperatureMax" : 65.71,
                                "apparentTemperatureMaxTime" : 1443596400,
                                "dewPoint" : 45.8,
                                "humidity" : 0.74,
                                "windSpeed" : 2.58,
                                "windBearing" : 148,
                                "cloudCover" : 0.1,
                                "pressure" : 1015.64,
                                "ozone" : 251.3
                            }, {
                                "time" : 1443636000,
                                "summary" : "Partly cloudy starting in the afternoon.",
                                "icon" : "partly-cloudy-night",
                                "sunriseTime" : 1443657298,
                                "sunsetTime" : 1443700206,
                                "moonPhase" : 0.62,
                                "precipIntensity" : 0.0008,
                                "precipIntensityMax" : 0.0019,
                                "precipIntensityMaxTime" : 1443711600,
                                "precipProbability" : 0.04,
                                "precipType" : "rain",
                                "temperatureMin" : 46.69,
                                "temperatureMinTime" : 1443654000,
                                "temperatureMax" : 65.76,
                                "temperatureMaxTime" : 1443682800,
                                "apparentTemperatureMin" : 46.69,
                                "apparentTemperatureMinTime" : 1443654000,
                                "apparentTemperatureMax" : 65.76,
                                "apparentTemperatureMaxTime" : 1443682800,
                                "dewPoint" : 46.86,
                                "humidity" : 0.74,
                                "windSpeed" : 2.9,
                                "windBearing" : 160,
                                "cloudCover" : 0.19,
                                "pressure" : 1015.98,
                                "ozone" : 249.46
                            }, {
                                "time" : 1443722400,
                                "summary" : "Partly cloudy starting in the afternoon.",
                                "icon" : "partly-cloudy-night",
                                "sunriseTime" : 1443743727,
                                "sunsetTime" : 1443786537,
                                "moonPhase" : 0.65,
                                "precipIntensity" : 0.0023,
                                "precipIntensityMax" : 0.0041,
                                "precipIntensityMaxTime" : 1443780000,
                                "precipProbability" : 0.13,
                                "precipType" : "rain",
                                "temperatureMin" : 47.27,
                                "temperatureMinTime" : 1443740400,
                                "temperatureMax" : 62.89,
                                "temperatureMaxTime" : 1443769200,
                                "apparentTemperatureMin" : 47.27,
                                "apparentTemperatureMinTime" : 1443740400,
                                "apparentTemperatureMax" : 62.89,
                                "apparentTemperatureMaxTime" : 1443769200,
                                "dewPoint" : 46.96,
                                "humidity" : 0.78,
                                "windSpeed" : 2.91,
                                "windBearing" : 165,
                                "cloudCover" : 0.32,
                                "pressure" : 1014.44,
                                "ozone" : 251.11
                            }, {
                                "time" : 1443808800,
                                "summary" : "Drizzle starting in the afternoon, continuing until evening.",
                                "icon" : "rain",
                                "sunriseTime" : 1443830155,
                                "sunsetTime" : 1443872869,
                                "moonPhase" : 0.69,
                                "precipIntensity" : 0.0046,
                                "precipIntensityMax" : 0.0062,
                                "precipIntensityMaxTime" : 1443870000,
                                "precipProbability" : 0.22,
                                "precipType" : "rain",
                                "temperatureMin" : 46.78,
                                "temperatureMinTime" : 1443830400,
                                "temperatureMax" : 60.65,
                                "temperatureMaxTime" : 1443855600,
                                "apparentTemperatureMin" : 46.78,
                                "apparentTemperatureMinTime" : 1443830400,
                                "apparentTemperatureMax" : 60.65,
                                "apparentTemperatureMaxTime" : 1443855600,
                                "dewPoint" : 46.41,
                                "humidity" : 0.79,
                                "windSpeed" : 2.95,
                                "windBearing" : 147,
                                "cloudCover" : 0.26,
                                "pressure" : 1014.14,
                                "ozone" : 260.1
                            }, {
                                "time" : 1443895200,
                                "summary" : "Partly cloudy throughout the day.",
                                "icon" : "partly-cloudy-day",
                                "sunriseTime" : 1443916584,
                                "sunsetTime" : 1443959202,
                                "moonPhase" : 0.72,
                                "precipIntensity" : 0.0029,
                                "precipIntensityMax" : 0.0036,
                                "precipIntensityMaxTime" : 1443949200,
                                "precipProbability" : 0.1,
                                "precipType" : "rain",
                                "temperatureMin" : 47.74,
                                "temperatureMinTime" : 1443913200,
                                "temperatureMax" : 59.49,
                                "temperatureMaxTime" : 1443942000,
                                "apparentTemperatureMin" : 47.74,
                                "apparentTemperatureMinTime" : 1443913200,
                                "apparentTemperatureMax" : 59.49,
                                "apparentTemperatureMaxTime" : 1443942000,
                                "dewPoint" : 45.43,
                                "humidity" : 0.77,
                                "windSpeed" : 3.63,
                                "windBearing" : 127,
                                "cloudCover" : 0.47,
                                "pressure" : 1015.88,
                                "ozone" : 264.75
                            }, {
                                "time" : 1443981600,
                                "summary" : "Clear throughout the day.",
                                "icon" : "clear-day",
                                "sunriseTime" : 1444003014,
                                "sunsetTime" : 1444045534,
                                "moonPhase" : 0.76,
                                "precipIntensity" : 0.0024,
                                "precipIntensityMax" : 0.0032,
                                "precipIntensityMaxTime" : 1444003200,
                                "precipProbability" : 0.09,
                                "precipType" : "rain",
                                "temperatureMin" : 46.74,
                                "temperatureMinTime" : 1443999600,
                                "temperatureMax" : 60.77,
                                "temperatureMaxTime" : 1444028400,
                                "apparentTemperatureMin" : 46.74,
                                "apparentTemperatureMinTime" : 1443999600,
                                "apparentTemperatureMax" : 60.77,
                                "apparentTemperatureMaxTime" : 1444028400,
                                "dewPoint" : 42.81,
                                "humidity" : 0.7,
                                "windSpeed" : 3.09,
                                "windBearing" : 109,
                                "cloudCover" : 0.09,
                                "pressure" : 1016.24,
                                "ozone" : 265.77
                            }, {
                                "time" : 1444068000,
                                "summary" : "Clear throughout the day.",
                                "icon" : "clear-day",
                                "sunriseTime" : 1444089443,
                                "sunsetTime" : 1444131867,
                                "moonPhase" : 0.79,
                                "precipIntensity" : 0.0019,
                                "precipIntensityMax" : 0.0025,
                                "precipIntensityMaxTime" : 1444086000,
                                "precipProbability" : 0.06,
                                "precipType" : "rain",
                                "temperatureMin" : 46.15,
                                "temperatureMinTime" : 1444086000,
                                "temperatureMax" : 62.58,
                                "temperatureMaxTime" : 1444114800,
                                "apparentTemperatureMin" : 46.15,
                                "apparentTemperatureMinTime" : 1444086000,
                                "apparentTemperatureMax" : 62.58,
                                "apparentTemperatureMaxTime" : 1444114800,
                                "dewPoint" : 40.1,
                                "humidity" : 0.62,
                                "windSpeed" : 2.34,
                                "windBearing" : 110,
                                "cloudCover" : 0,
                                "pressure" : 1015.56,
                                "ozone" : 258.79
                            }, {
                                "time" : 1444154400,
                                "summary" : "Partly cloudy starting in the evening.",
                                "icon" : "partly-cloudy-night",
                                "sunriseTime" : 1444175873,
                                "sunsetTime" : 1444218201,
                                "moonPhase" : 0.82,
                                "precipIntensity" : 0.0019,
                                "precipIntensityMax" : 0.0023,
                                "precipIntensityMaxTime" : 1444230000,
                                "precipProbability" : 0.05,
                                "precipType" : "rain",
                                "temperatureMin" : 46.88,
                                "temperatureMinTime" : 1444172400,
                                "temperatureMax" : 62.48,
                                "temperatureMaxTime" : 1444201200,
                                "apparentTemperatureMin" : 46.88,
                                "apparentTemperatureMinTime" : 1444172400,
                                "apparentTemperatureMax" : 62.48,
                                "apparentTemperatureMaxTime" : 1444201200,
                                "dewPoint" : 42.9,
                                "humidity" : 0.66,
                                "windSpeed" : 2.58,
                                "windBearing" : 144,
                                "cloudCover" : 0.09,
                                "pressure" : 1014.98,
                                "ozone" : 249.79
                            }
                        ]
                    },
                    "flags" : {
                        "sources" : ["isd", "madis", "fnmoc", "cmc", "gfs"],
                        "isd-stations" : ["422950-99999", "422990-99999", "423990-99999", "424030-99999", "557730-99999"],
                        "madis-stations" : ["VQPR"],
                        "units" : "us"
                    }
                }
            }
    }

})();
