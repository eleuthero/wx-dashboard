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

        /*
        Registers one or more timers to be called by WxDashboard.
        The timers parameter is an object with one or more keys
        of the form:
             timer_key: { interval: <int>
                              timer interval in milliseconds
                          onElapsed: <function>
                              function called when timer interval
                              elapses. }
        */
        registerTimers:
            function (timers)
            {
                for (var key in timers)
                {
                    var timer = timers[key];

                    if (! WxDashboard._timers[key])
                    {
                        WxDashboard._timers[key] = timer;
                    }
                    else
                    {
                        alert
                        (
                            'WxDashboard.registerTimers:',
                            'timer key',
                            key,
                            'already exists.'
                        );
                    }
                }
            },

        start:
            function ()
            {
                // Initialize the UI and get the timers going.

                WxDashboard._onTimerTick();
            },

        /* Add or replace a message in the status bar.
            {
                source: <string>,   required
                message: <string>,  required
                isError: <bool>     default: false.
            }
        */ 
        registerStatus:
            function (info)
            {
                info =
                    $.extend
                    (
                        { },
                        {
                            source: '',
                            message: '',
                            isError: false
                        },
                        info || { }
                    );

                var $status = $('.STATUS');

                // See if this status message has already been registered.

                var $current =
                    $status
                        .children()
                            .filter
                            (
                                function ()
                                {
                                    return (info.source ===
                                            $(this).data('source'));
                                }
                            );

                // If not, add it.

                if (! $current.length)
                {
                    $current =
                        $('<div>')
                            .hide()
                            .data('source', info.source)
                            .appendTo($status);
                }

                $current
                    .text(info.message)
                    .toggleClass('ERROR', info.isError);
            },

        formatMillis:
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

        formatDate:
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

        getWeekdayName:
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

        formatTime:
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

        cycleContainer:
            function ($container)
            {
                if ($container.children().length < 2)
                {
                    // Not enough children to toggle.

                    return;
                }

                var $current = $container.children(':visible');

                if (! $current.length)
                {
                    $current = $container.children(':first');
                }

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

        // private:

        _settings: null,            // Settings, per instance
        _timer: null,               // timeout ID of driving timer.
        _TIMER_INTERVAL: 15000,     // granularity of driving timer, in ms.

        _timers:
            {
                // Timer for general, low-cost UI refreshes for the
                // clock and ephemeris.

                _ui_timer:
                    {
                        interval: 15000,    // 15 seconds

                        onElapsed:
                            function ()
                            {
                                WxDashboard._onUITimerElapse();
                            }
                    },
            },

        // Default settings.

        _defaultSettings:
            {
                // Enable for debugging.

                debug: false
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
                        Math.max
                        (
                            (timer._remaining || 0)
                                - WxDashboard._TIMER_INTERVAL,
                            0
                        );

                    WxDashboard._debug
                    (
                        [
                            'WxDashboard._onTimerTick(): ',
                            'timer [',
                            key,
                            '] remaining: ',
                            WxDashboard.formatMillis(remaining),
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
                                'timer [',
                                key,
                                '] firing.'
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

        _onUITimerElapse:
            function ()
            {
                WxDashboard._debug('WxDashboard._onUITimerElapse();');

                WxDashboard._updateCurrentTime();
                WxDashboard._updateCurrentDate();
                WxDashboard.cycleContainer( $('.STATUS') );
            },

        _updateCurrentTime:
            function ()
            {
                WxDashboard.formatTime
                (
                    new Date(),
                    $('.CURRENT_TIME')
                );
            },

        _updateCurrentDate:
            function ()
            {
                WxDashboard.formatDate
                (
                    new Date(),
                    $('.CURRENT_DATE')
                );
            },

        _debug:
            function (message)
            {
                if (WxDashboard._settings.debug)
                {
                    console.log(message);
                }
            },
    }

})();
