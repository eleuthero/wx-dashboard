if (! this.WsDotCommute)
{
    this.WsDotCommute = { };
}

(function ()
{
    /*
        This will only be useful if you happen to live in the Puget
        Sound region of Washington state, but it's easily adaptable if
        your local transit authority has a traffic API.  If you don't,
        or commuting information is not of interest to you, you can
        remove references to it from the codeahead.
    */
    this.WsDotCommute =
    {
        // public:

        init:
            function (settings)
            {
                WsDotCommute._init(settings);

                WsDotCommute._registerTimers();
            },

        // private:

        // Set with your own wsdot.com API key.
        // You can obtain one at http://wsdot.com/traffic/api.

        _APIKEY: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',

        // Default settings.

        _defaultSettings:
            {
                // If true, a static response will be hydrated from a
                // static JSON object and used.  Saves on your API call
                // count if you're developing.

                useStatic: false,

                // Enable for debugging.

                debug: false,

                // Filter for commute routes.  By default, return all
                // routes that contain "Seattle" in the description.

                filter:
                    function (json)
                    {
                        json.Description
                            .toLowerCase()
                            .indexOf('seattle') >= 0;
                    },

                // Sort function for commute routes.
                // By default, sort by current route time,
                // then by route description.

                sort:
                    function (a, b)
                    {
                        return (a.current > b.current)
                               || ( (a.current == b.current)
                                    && (a.desc > b.desc) );
                    },

                // Maximum number of routes to display.

                maxRoutes: 7
            },

        _init:
            function (settings)
            {
                WsDotCommute._settings =
                    $.extend
                    (
                        { },
                        WsDotCommute._defaultSettings,
                        settings || { }
                    );
            
                WsDotCommute._decorateImages();
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

        _registerTimers:
            function ()
            {
                WxDashboard.registerTimers
                (
                    {
                        commute_timer:
                            {
                                // Update commute info once an hour.

                                interval: 60 * 60 * 1000,   

                                onElapsed:
                                    function ()
                                    {
                                        WsDotCommute._requestCommuteInfo();
                                    }
                            },
                    }
                );
            },

        _requestCommuteInfo:
            function ()
            {
                WsDotCommute._debug('WsDotCommute._requestCommuteInfo();');

                // If we're using the static info, just return one
                // from the debugging function.  Saves on API calls when
                // developing.

                if (WsDotCommute._settings.useStatic)
                {
                    WsDotCommute._debug
                    (
                        [
                            'WsDotCommute._requestCommuteInfo():',
                            'using static commute response.'
                        ]
                        .join(' ')
                    );

                    WsDotCommute._onCommuteInfoReceived
                    (
                        WsDotCommute._getStaticCommuteInfo()
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
                        'http://wsdot.com/Traffic/api/TravelTimes',
                        '/TravelTimesRest.svc/GetTravelTimesAsJson',
                        '?AccessCode=',
                        WsDotCommute._APIKEY,
                        '&callback=?'
                    ]
                    .join('');

                WsDotCommute._debug
                (
                    'WsDotCommute._requestCommuteInfo(): url: ' + url
                );

                $.getJSON(url)
                    .done
                    (
                        function (data)
                        {
                            WsDotCommute._debug
                            (
                                'WsDotCommute._requestCommuteInfo(): success.'
                            );

                            WsDotCommute._onCommuteInfoReceived(data);
                        }
                    )
                    .fail
                    (
                        function (_, textStatus, errorThrown)
                        {
                            WsDotCommute._debug
                            (
                                [
                                    'WsDotCommute._requestForecast(): fail:',
                                    'textstatus:', textStatus,
                                    'errorThrown:', errorThrown
                                ]
                                .join(' ')
                            );

                            // Set the status bar message and indicate
                            // an error.

                            WxDashboard.registerStatus
                            (
                                {
                                    source: 'wsdot-commute',
                                    message:
                                        [
                                            'Error requesting commute info:',
                                            errorThrown
                                        ]
                                        .join(' '),
                                    isError: true
                                }
                            );
                        }
                    );
            },

        _onCommuteInfoReceived:
            function (data)
            {
                WsDotCommute._debug
                (
                    [
                        'WsDotCommute._onCommuteInfoReceived(): received',
                        JSON.stringify(data).length,
                        'chars of commute data.'
                    ]
                    .join(' ')
                );

                WxDashboard.registerStatus 
                (
                    {
                        source: 'wsdot-commute',
                        message:
                            [
                                'Commute info updated ',
                                WxDashboard.formatDate
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
                                WxDashboard.formatTime
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
                    }
                );

                WsDotCommute._updateRoutes(data);
            },

        _updateRoutes:
            function (data)
            {
                WsDotCommute._debug
                (
                    [
                        'WsDotCommute._updateRoutes(): received',
                        data.length,
                        'routes.'
                    ]
                    .join(' ')
                );

                // Filter out routes whose Description property matches
                // the requested search term.

                var commutes =
                    data
                        .filter
                        (
                            // Filter out commutes that meet the
                            // requested criteria.

                            WsDotCommute._settings.filter
                        );

                WsDotCommute._debug
                (
                    [
                        'WsDotCommute._updateRoutes(): found',
                        commutes.length,
                        'matching routes.'
                    ]
                    .join(' ')
                );

                // Generate info for routes.

                var infos =
                    commutes
                        .map
                        (
                            function (item)
                            {
                                return WsDotCommute._getCommuteInfo(item);
                            }
                        )
                        .filter
                        (
                            // Filter out closed/unavailable routes.

                            function (item, _, _)
                            {
                                return (null !== item);
                            }
                        );

                // Sort routes.

                infos.sort(WsDotCommute._settings.sort);

                WsDotCommute._debug
                (
                    [
                        'WsDotCommute._updateRoutes(): found',
                        infos.length,
                        'available matching routes:'
                    ]
                    .join(' ')
                );
                WsDotCommute._debug
                (
                    infos.map
                    (
                        function (item, _, _)
                        {
                            return JSON.stringify(item);
                        }
                    )
                    .join('\n')
                );

                // Update route UI.

                WsDotCommute._updateCommuteUI(infos);
            },

        _updateCommuteUI:
            function (descs)
            {
                WsDotCommute._debug('WsDotCommute._updateCommuteUI();');

                var $commutes = $('.COMMUTES');

                // Clear current route UI.

                $commutes
                    .children(':visible')
                        .remove();

                for (var i = 0;
                         i < Math.min(descs.length,
                                      WsDotCommute._settings.maxRoutes);
                         i++)
                {
                    var desc = descs[i];

                    var $clone =
                        $('.COMMUTE_TEMPLATE')
                            .clone();

                    $clone
                        .removeClass('COMMUTE_TEMPLATE')
                        .find('.COMMUTE_TEXT')
                            .text(desc.description)
                            .end();

                    WsDotCommute._setDiffUI
                    (
                        $clone.find('.COMMUTE_DIFF'),
                        desc.diff
                    );

                    $clone
                        .appendTo($commutes)
                        .show();
                }
            },

        _getCommuteInfo:
            function (route)
            {
                var current = parseInt(route.CurrentTime, 10);
                var average = parseInt(route.AverageTime, 10);

                // Current or average times of 0 indicate that a route is
                // currently closed or unavailable (i.e., express lanes).

                if ( (! current) || (! average) )
                {
                    return null;
                }

                // Otherwise, the route is available.

                return {
                    description:
                       [
                           route.Description,
                           ': ',
                           route.CurrentTime,
                           ' min'
                       ]
                       .join(''),
                    current: current,
                    average: average,
                    diff: (average - current)
                };
            },

        _setDiffUI:
            function ($target, diff)
            {
                if (diff > 0)
                {
                    // Route is faster than average.

                    $target
                        .addClass('COMMUTE_FAST')
                        .text
                        (
                            '(+' + diff + ')'
                        );
                }
                else if (diff < 0)
                {
                    // Route is slower than average.

                    $target
                        .addClass('COMMUTE_SLOW')
                        .text
                        (
                            '(-' + (-diff) + ')'
                        );
                }
                else
                {
                    $target.hide();
                }
            },

        /* Utilities */

        _debug:
            function (message)
            {
                if (WsDotCommute._settings.debug)
                {
                    console.log(message);
                }
            },

        _getStaticCommuteInfo:
            function ()
            {
                return [
                    {
                        "AverageTime" : 44,
                        "CurrentTime" : 31,
                        "Description" : "Everett to Downtown Seattle",
                        "Distance" : 26.72,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Everett-Seattle (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "S",
                            "Latitude" : 47.964410000,
                            "Longitude" : -122.199190000,
                            "MilePost" : 192.55,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 1
                    }, {
                        "AverageTime" : 41,
                        "CurrentTime" : 29,
                        "Description" : "Everett to Downtown Seattle using HOV lanes",
                        "Distance" : 26.72,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Everett-Seattle (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "S",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.55,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 2
                    }, {
                        "AverageTime" : 28,
                        "CurrentTime" : 27,
                        "Description" : "Downtown Seattle to Everett using HOV lanes",
                        "Distance" : 26.94,
                        "EndPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "N",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.77,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Seattle-Everett (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 3
                    }, {
                        "AverageTime" : 33,
                        "CurrentTime" : 28,
                        "Description" : "Downtown Seattle to Everett",
                        "Distance" : 26.94,
                        "EndPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "N",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.77,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Seattle-Everett (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 4
                    }, {
                        "AverageTime" : 14,
                        "CurrentTime" : 12,
                        "Description" : "Downtown Bellevue to Issaquah",
                        "Distance" : 9.55,
                        "EndPoint" : {
                            "Description" : "I-90 @ Front St in Issaquah",
                            "Direction" : "E",
                            "Latitude" : 47.541799000,
                            "Longitude" : -122.037396000,
                            "MilePost" : 16.96,
                            "RoadName" : "I-90"
                        },
                        "Name" : "Bellevue-Issaquah (EB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 5
                    }, {
                        "AverageTime" : 11,
                        "CurrentTime" : 11,
                        "Description" : "Downtown Bellevue to Issaquah using HOV lanes",
                        "Distance" : 9.55,
                        "EndPoint" : {
                            "Description" : "I-90 @ Front St in Issaquah",
                            "Direction" : "E",
                            "Latitude" : 47.541799000,
                            "Longitude" : -122.037396000,
                            "MilePost" : 16.96,
                            "RoadName" : "I-90"
                        },
                        "Name" : "HOV Bellevue-Issaquah (EB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 6
                    }, {
                        "AverageTime" : 10,
                        "CurrentTime" : 10,
                        "Description" : "Issaquah to Downtown Bellevue using HOV lanes",
                        "Distance" : 9.48,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Issaquah-Bellevue (WB AM)",
                        "StartPoint" : {
                            "Description" : "I-90 @ Front St in Issaquah",
                            "Direction" : "W",
                            "Latitude" : 47.541799000,
                            "Longitude" : -122.037396000,
                            "MilePost" : 16.96,
                            "RoadName" : "I-90"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 7
                    }, {
                        "AverageTime" : 11,
                        "CurrentTime" : 10,
                        "Description" : "Issaquah to Downtown Bellevue",
                        "Distance" : 9.48,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Issaquah-Bellevue (WB AM)",
                        "StartPoint" : {
                            "Description" : "I-90 @ Front St in Issaquah",
                            "Direction" : "W",
                            "Latitude" : 47.541799000,
                            "Longitude" : -122.037396000,
                            "MilePost" : 16.96,
                            "RoadName" : "I-90"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 8
                    }, {
                        "AverageTime" : 32,
                        "CurrentTime" : 34,
                        "Description" : "Downtown Bellevue to Everett",
                        "Distance" : 26.04,
                        "EndPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "N",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.77,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Bellevue-Everett (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 9
                    }, {
                        "AverageTime" : 31,
                        "CurrentTime" : 32,
                        "Description" : "Everett to Downtown Bellevue",
                        "Distance" : 26.32,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Everett-Bellevue (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "S",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.55,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 10
                    }, {
                        "AverageTime" : 28,
                        "CurrentTime" : 26,
                        "Description" : "Downtown Bellevue to Everett using HOV lanes",
                        "Distance" : 26.04,
                        "EndPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "N",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.77,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Bellevue-Everett (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 11
                    }, {
                        "AverageTime" : 27,
                        "CurrentTime" : 27,
                        "Description" : "Everett to Downtown Bellevue using HOV lanes",
                        "Distance" : 26.32,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Everett-Bellevue (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "S",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.55,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 12
                    }, {
                        "AverageTime" : 9,
                        "CurrentTime" : 9,
                        "Description" : "Federal Way to SeaTac",
                        "Distance" : 8.82,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 188th St in SeaTac",
                            "Direction" : "N",
                            "Latitude" : 47.438760000,
                            "Longitude" : -122.269470000,
                            "MilePost" : 152.80,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Federal Way-SeaTac (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "N",
                            "Latitude" : 47.315446000,
                            "Longitude" : -122.296702000,
                            "MilePost" : 143.98,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 13
                    }, {
                        "AverageTime" : 9,
                        "CurrentTime" : 9,
                        "Description" : "Federal Way to SeaTac using HOV lanes",
                        "Distance" : 8.82,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 188th St in SeaTac",
                            "Direction" : "N",
                            "Latitude" : 47.438760000,
                            "Longitude" : -122.269470000,
                            "MilePost" : 152.80,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Federal Way-SeaTac (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "N",
                            "Latitude" : 47.315446000,
                            "Longitude" : -122.296702000,
                            "MilePost" : 143.98,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 14
                    }, {
                        "AverageTime" : 9,
                        "CurrentTime" : 9,
                        "Description" : "SeaTac to Federal Way using HOV lanes",
                        "Distance" : 9.16,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "S",
                            "Latitude" : 47.313840000,
                            "Longitude" : -122.298609000,
                            "MilePost" : 143.64,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV SeaTac-Federal Way (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ S 188th St in SeaTac",
                            "Direction" : "S",
                            "Latitude" : 47.438760000,
                            "Longitude" : -122.269470000,
                            "MilePost" : 152.80,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 15
                    }, {
                        "AverageTime" : 10,
                        "CurrentTime" : 10,
                        "Description" : "SeaTac to Federal Way",
                        "Distance" : 9.16,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "S",
                            "Latitude" : 47.313840000,
                            "Longitude" : -122.298609000,
                            "MilePost" : 143.64,
                            "RoadName" : "I-5"
                        },
                        "Name" : "SeaTac-Federal Way (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ S 188th St in SeaTac",
                            "Direction" : "S",
                            "Latitude" : 47.438760000,
                            "Longitude" : -122.269470000,
                            "MilePost" : 152.80,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 16
                    }, {
                        "AverageTime" : 25,
                        "CurrentTime" : 23,
                        "Description" : "Federal Way to Downtown Seattle",
                        "Distance" : 22.15,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Federal Way-Seattle (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "N",
                            "Latitude" : 47.315446000,
                            "Longitude" : -122.296702000,
                            "MilePost" : 143.98,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 17
                    }, {
                        "AverageTime" : 24,
                        "CurrentTime" : 22,
                        "Description" : "Federal Way to Downtown Seattle using HOV lanes",
                        "Distance" : 22.15,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Federal Way-Seattle (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "N",
                            "Latitude" : 47.315446000,
                            "Longitude" : -122.296702000,
                            "MilePost" : 143.98,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 18
                    }, {
                        "AverageTime" : 23,
                        "CurrentTime" : 22,
                        "Description" : "Downtown Seattle to Federal Way using HOV lanes",
                        "Distance" : 22.19,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "S",
                            "Latitude" : 47.313840000,
                            "Longitude" : -122.298609000,
                            "MilePost" : 143.64,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Seattle-Federal Way (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 19
                    }, {
                        "AverageTime" : 24,
                        "CurrentTime" : 23,
                        "Description" : "Downtown Seattle to Federal Way",
                        "Distance" : 22.19,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "S",
                            "Latitude" : 47.313840000,
                            "Longitude" : -122.298609000,
                            "MilePost" : 143.64,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Seattle-Federal Way (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 20
                    }, {
                        "AverageTime" : 49,
                        "CurrentTime" : 34,
                        "Description" : "Downtown Bellevue to Federal Way",
                        "Distance" : 24.56,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "S",
                            "Latitude" : 47.313840000,
                            "Longitude" : -122.298609000,
                            "MilePost" : 143.64,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Bellevue-Federal Way (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 21
                    }, {
                        "AverageTime" : 28,
                        "CurrentTime" : 27,
                        "Description" : "Federal Way to Downtown Bellevue",
                        "Distance" : 23.58,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Federal Way-Bellevue (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "N",
                            "Latitude" : 47.315446000,
                            "Longitude" : -122.296702000,
                            "MilePost" : 143.98,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 22
                    }, {
                        "AverageTime" : 28,
                        "CurrentTime" : 25,
                        "Description" : "Downtown Bellevue to Federal Way using HOV lanes",
                        "Distance" : 24.56,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "S",
                            "Latitude" : 47.313840000,
                            "Longitude" : -122.298609000,
                            "MilePost" : 143.64,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Bellevue-Federal Way (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 23
                    }, {
                        "AverageTime" : 24,
                        "CurrentTime" : 24,
                        "Description" : "Federal Way to Downtown Bellevue using HOV lanes",
                        "Distance" : 23.58,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Federal Way-Bellevue (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "N",
                            "Latitude" : 47.315446000,
                            "Longitude" : -122.296702000,
                            "MilePost" : 143.98,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 24
                    }, {
                        "AverageTime" : 17,
                        "CurrentTime" : 16,
                        "Description" : "Downtown Seattle to Lynnwood using HOV lanes",
                        "Distance" : 15.73,
                        "EndPoint" : {
                            "Description" : "I-5 @ 196th St SW in Lynnwood",
                            "Direction" : "N",
                            "Latitude" : 47.819545000,
                            "Longitude" : -122.279109000,
                            "MilePost" : 181.56,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Seattle-Lynnwood (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 25
                    }, {
                        "AverageTime" : 31,
                        "CurrentTime" : 18,
                        "Description" : "Lynnwood to Downtown Seattle",
                        "Distance" : 15.23,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Lynnwood-Seattle (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 196th St SW in Lynnwood",
                            "Direction" : "S",
                            "Latitude" : 47.817269000,
                            "Longitude" : -122.285137000,
                            "MilePost" : 181.06,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 26
                    }, {
                        "AverageTime" : 17,
                        "CurrentTime" : 16,
                        "Description" : "Downtown Seattle to Lynnwood",
                        "Distance" : 15.73,
                        "EndPoint" : {
                            "Description" : "I-5 @ 196th St SW in Lynnwood",
                            "Direction" : "N",
                            "Latitude" : 47.819545000,
                            "Longitude" : -122.279109000,
                            "MilePost" : 181.56,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Seattle-Lynnwood (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 27
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Lynnwood to Downtown Seattle using express lanes and HOV lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Lynnwood-Seattle (SB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 196th St SW in Lynnwood",
                            "Direction" : "S",
                            "Latitude" : 47.817269000,
                            "Longitude" : -122.285137000,
                            "MilePost" : 181.06,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 28
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Lynnwood to Downtown Seattle using express lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Lynnwood-Seattle (SB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 196th St SW in Lynnwood",
                            "Direction" : "S",
                            "Latitude" : 47.817269000,
                            "Longitude" : -122.285137000,
                            "MilePost" : 181.06,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 29
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 14,
                        "Description" : "Renton to Downtown Seattle using HOV lanes",
                        "Distance" : 13.77,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Renton-Seattle (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ SR 167 in Renton",
                            "Direction" : "S",
                            "Latitude" : 47.467434000,
                            "Longitude" : -122.219631000,
                            "MilePost" : 2.21,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 30
                    }, {
                        "AverageTime" : 14,
                        "CurrentTime" : 14,
                        "Description" : "Downtown Seattle to Renton using HOV lanes",
                        "Distance" : 13.61,
                        "EndPoint" : {
                            "Description" : "I-405 @ SR 167 in Renton",
                            "Direction" : "N",
                            "Latitude" : 47.467434000,
                            "Longitude" : -122.219631000,
                            "MilePost" : 2.21,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Seattle-Renton (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 31
                    }, {
                        "AverageTime" : 17,
                        "CurrentTime" : 14,
                        "Description" : "Renton to Downtown Seattle",
                        "Distance" : 13.69,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Renton-Seattle (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ SR 167 in Renton",
                            "Direction" : "S",
                            "Latitude" : 47.467434000,
                            "Longitude" : -122.219631000,
                            "MilePost" : 2.21,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 32
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 15,
                        "Description" : "Downtown Seattle to Renton",
                        "Distance" : 13.61,
                        "EndPoint" : {
                            "Description" : "I-405 @ SR 167 in Renton",
                            "Direction" : "N",
                            "Latitude" : 47.467434000,
                            "Longitude" : -122.219631000,
                            "MilePost" : 2.21,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Seattle-Renton (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 33
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Northgate to Downtown Seattle using express lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Shoreline-Seattle (SB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ NE Northgate Way in Northgate",
                            "Direction" : "S",
                            "Latitude" : 47.774180000,
                            "Longitude" : -122.329912000,
                            "MilePost" : 171.62,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 34
                    }, {
                        "AverageTime" : 18,
                        "CurrentTime" : 23,
                        "Description" : "Downtown Bellevue to Lynnwood",
                        "Distance" : 15.59,
                        "EndPoint" : {
                            "Description" : "I-5 @ SR 526 in Lynnwood",
                            "Direction" : "N",
                            "Latitude" : 47.920431000,
                            "Longitude" : -122.206552000,
                            "MilePost" : 29.51,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Bellevue-Lynnwood (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.92,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 35
                    }, {
                        "AverageTime" : 15,
                        "CurrentTime" : 15,
                        "Description" : "Downtown Bellevue to Lynnwood using HOV lanes",
                        "Distance" : 14.88,
                        "EndPoint" : {
                            "Description" : "I-5 @ SR 526 in Lynnwood",
                            "Direction" : "N",
                            "Latitude" : 47.920431000,
                            "Longitude" : -122.206552000,
                            "MilePost" : 29.51,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Bellevue-Lynnwood (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 14.63,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 36
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 16,
                        "Description" : "Lynnwood to Downtown Bellevue using HOV lanes",
                        "Distance" : 16.18,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Lynnwood-Bellevue (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ SR 526 in Lynnwood",
                            "Direction" : "S",
                            "Latitude" : 47.920431000,
                            "Longitude" : -122.206552000,
                            "MilePost" : 29.51,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 37
                    }, {
                        "AverageTime" : 19,
                        "CurrentTime" : 20,
                        "Description" : "Lynnwood to Downtown Bellevue",
                        "Distance" : 16.18,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Lynnwood-Bellevue (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ SR 526 in Lynnwood",
                            "Direction" : "S",
                            "Latitude" : 47.920431000,
                            "Longitude" : -122.206552000,
                            "MilePost" : 29.51,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 38
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Everett to Downtown Seattle using express lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Everett-Seattle (SB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "S",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.55,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 39
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Everett to Downtown Seattle using express lanes and HOV lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "1B HOV Everett-Seattle (SB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "S",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.55,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 40
                    }, {
                        "AverageTime" : 15,
                        "CurrentTime" : 13,
                        "Description" : "SeaTac to Downtown Seattle using HOV lanes",
                        "Distance" : 13.33,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV SeaTac-Seattle (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ S 188th St in SeaTac",
                            "Direction" : "N",
                            "Latitude" : 47.438760000,
                            "Longitude" : -122.269470000,
                            "MilePost" : 152.80,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 41
                    }, {
                        "AverageTime" : 14,
                        "CurrentTime" : 13,
                        "Description" : "Downtown Seattle to SeaTac using HOV lanes",
                        "Distance" : 13.03,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 188th St in SeaTac",
                            "Direction" : "S",
                            "Latitude" : 47.438760000,
                            "Longitude" : -122.269470000,
                            "MilePost" : 152.80,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Seattle-SeaTac (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 42
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 13,
                        "Description" : "SeaTac to Downtown Seattle",
                        "Distance" : 13.03,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "SeaTac-Seattle (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ S 188th St in SeaTac",
                            "Direction" : "N",
                            "Latitude" : 47.438760000,
                            "Longitude" : -122.269470000,
                            "MilePost" : 152.80,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 43
                    }, {
                        "AverageTime" : 14,
                        "CurrentTime" : 14,
                        "Description" : "Downtown Seattle to SeaTac",
                        "Distance" : 13.03,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 188th St in SeaTac",
                            "Direction" : "S",
                            "Latitude" : 47.438760000,
                            "Longitude" : -122.269470000,
                            "MilePost" : 152.80,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Seattle-SeaTac (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 44
                    }, {
                        "AverageTime" : 30,
                        "CurrentTime" : 19,
                        "Description" : "Downtown Bellevue to Renton",
                        "Distance" : 11.12,
                        "EndPoint" : {
                            "Description" : "I-405 @ SR 167 in Renton",
                            "Direction" : "S",
                            "Latitude" : 47.467434000,
                            "Longitude" : -122.219631000,
                            "MilePost" : 2.21,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Bellevue-Renton (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 45
                    }, {
                        "AverageTime" : 13,
                        "CurrentTime" : 11,
                        "Description" : "Downtown Bellevue to Renton using HOV lanes",
                        "Distance" : 11.12,
                        "EndPoint" : {
                            "Description" : "I-405 @ SR 167 in Renton",
                            "Direction" : "S",
                            "Latitude" : 47.467434000,
                            "Longitude" : -122.219631000,
                            "MilePost" : 2.21,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Bellevue-Renton (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 46
                    }, {
                        "AverageTime" : 57,
                        "CurrentTime" : 41,
                        "Description" : "Alderwood to Southcenter via I-405",
                        "Distance" : 29.40,
                        "EndPoint" : {
                            "Description" : "I-405 @ I-5 in Tukwila",
                            "Direction" : "S",
                            "Latitude" : 47.463303000,
                            "Longitude" : -122.262701000,
                            "MilePost" : 0.11,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Alderwood to Southcenter via I-405 (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ SR 525 in Lynnwood",
                            "Direction" : "S",
                            "Latitude" : 47.823700000,
                            "Longitude" : -122.251700000,
                            "MilePost" : 29.51,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 51
                    }, {
                        "AverageTime" : 46,
                        "CurrentTime" : 32,
                        "Description" : "Alderwood to Southcenter via I-5",
                        "Distance" : 27.97,
                        "EndPoint" : {
                            "Description" : "I-5 @ I-405 in Tukwila",
                            "Direction" : "S",
                            "Latitude" : 47.464800000,
                            "Longitude" : -122.265700000,
                            "MilePost" : 154.65,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Alderwood to Southcenter via I-5 (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ I-405 in Lynnwood",
                            "Direction" : "S",
                            "Latitude" : 47.830800000,
                            "Longitude" : -122.263600000,
                            "MilePost" : 182.62,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 52
                    }, {
                        "AverageTime" : 40,
                        "CurrentTime" : 40,
                        "Description" : "Southcenter to Alderwood via I-405",
                        "Distance" : 29.40,
                        "EndPoint" : {
                            "Description" : "I-5 @ I-405 in Lynnwood",
                            "Direction" : "N",
                            "Latitude" : 47.830800000,
                            "Longitude" : -122.263600000,
                            "MilePost" : 29.51,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Southcenter to Alderwood via I-405 (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ I-5 in Tukwila",
                            "Direction" : "N",
                            "Latitude" : 47.463303000,
                            "Longitude" : -122.262701000,
                            "MilePost" : 0.11,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 53
                    }, {
                        "AverageTime" : 35,
                        "CurrentTime" : 28,
                        "Description" : "Southcenter to Alderwood via I-5",
                        "Distance" : 27.39,
                        "EndPoint" : {
                            "Description" : "I-5 @ I-405 in Lynnwood",
                            "Direction" : "N",
                            "Latitude" : 47.830800000,
                            "Longitude" : -122.263600000,
                            "MilePost" : 182.04,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Southcenter to Alderwood via I-5 (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ I-405 in Tukwila",
                            "Direction" : "N",
                            "Latitude" : 47.464800000,
                            "Longitude" : -122.265700000,
                            "MilePost" : 154.65,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 54
                    }, {
                        "AverageTime" : 11,
                        "CurrentTime" : 13,
                        "Description" : "Downtown Bellevue to SR 522 in Bothell",
                        "Distance" : 9.41,
                        "EndPoint" : {
                            "Description" : "I-405 @ SR 522 in Bothell",
                            "Direction" : "N",
                            "Latitude" : 47.751518000,
                            "Longitude" : -122.187178000,
                            "MilePost" : 23.01,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Bellevue-SR 522 (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 55
                    }, {
                        "AverageTime" : 11,
                        "CurrentTime" : 9,
                        "Description" : "Downtown Bellevue to SR 522 in Bothell using HOV lanes",
                        "Distance" : 9.41,
                        "EndPoint" : {
                            "Description" : "I-405 @ SR 522 in Bothell",
                            "Direction" : "N",
                            "Latitude" : 47.751518000,
                            "Longitude" : -122.187178000,
                            "MilePost" : 23.01,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Bellevue-SR 522 (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 56
                    }, {
                        "AverageTime" : 10,
                        "CurrentTime" : 10,
                        "Description" : "SR 522 in Bothell to Downtown Bellevue using HOV lanes",
                        "Distance" : 9.68,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV SR 522-Bellevue (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ SR 522 in Bothell",
                            "Direction" : "S",
                            "Latitude" : 47.751518000,
                            "Longitude" : -122.187178000,
                            "MilePost" : 23.01,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 57
                    }, {
                        "AverageTime" : 12,
                        "CurrentTime" : 13,
                        "Description" : "SR 522 in Bothell to Downtown Bellevue",
                        "Distance" : 9.68,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "Name" : "SR 522-Bellevue",
                        "StartPoint" : {
                            "Description" : "I-405 @ SR 522 in Bothell",
                            "Direction" : "S",
                            "Latitude" : 47.751518000,
                            "Longitude" : -122.187178000,
                            "MilePost" : 23.01,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 58
                    }, {
                        "AverageTime" : 28,
                        "CurrentTime" : 26,
                        "Description" : "Woodinville to Downtown Seattle",
                        "Distance" : 20.26,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Woodinville-Seattle via I-90 (WB AM)",
                        "StartPoint" : {
                            "Description" : "SR 522 @ SR 202 in Woodinville",
                            "Direction" : "S",
                            "Latitude" : 47.758180000,
                            "Longitude" : -122.164020000,
                            "MilePost" : 23.01,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 59
                    }, {
                        "AverageTime" : 24,
                        "CurrentTime" : 25,
                        "Description" : "Woodinville to Downtown Seattle",
                        "Distance" : 18.25,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Woodinville-Seattle via SR 520 (WB AM)",
                        "StartPoint" : {
                            "Description" : "SR 522 @ SR 202 in Woodinville",
                            "Direction" : "S",
                            "Latitude" : 47.758180000,
                            "Longitude" : -122.164020000,
                            "MilePost" : 23.01,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 60
                    }, {
                        "AverageTime" : 34,
                        "CurrentTime" : 21,
                        "Description" : "Downtown Bellevue to Tukwila",
                        "Distance" : 13.22,
                        "EndPoint" : {
                            "Description" : "I-405 @ I-5 in Tukwila",
                            "Direction" : "S",
                            "Latitude" : 47.463303000,
                            "Longitude" : -122.262701000,
                            "MilePost" : 0.11,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Bellevue-Tukwila (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 63
                    }, {
                        "AverageTime" : 15,
                        "CurrentTime" : 13,
                        "Description" : "Downtown Bellevue to Tukwila using HOV lanes",
                        "Distance" : 13.22,
                        "EndPoint" : {
                            "Description" : "I-405 @ I-5 in Tukwila",
                            "Direction" : "S",
                            "Latitude" : 47.463303000,
                            "Longitude" : -122.262701000,
                            "MilePost" : 0.11,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Bellevue-Tukwila (SB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 64
                    }, {
                        "AverageTime" : 14,
                        "CurrentTime" : 14,
                        "Description" : "Tukwila to Downtown Bellevue using HOV lanes",
                        "Distance" : 13.49,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Tukwila-Bellevue (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ I-5 in Tukwila",
                            "Direction" : "N",
                            "Latitude" : 47.463303000,
                            "Longitude" : -122.262701000,
                            "MilePost" : 0.11,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 65
                    }, {
                        "AverageTime" : 11,
                        "CurrentTime" : 11,
                        "Description" : "Auburn to Renton",
                        "Distance" : 9.76,
                        "EndPoint" : {
                            "Description" : "SR 167 @ I-405 in Renton",
                            "Direction" : "N",
                            "Latitude" : 47.458000000,
                            "Longitude" : -122.217000000,
                            "MilePost" : 25.62,
                            "RoadName" : "SR 167"
                        },
                        "Name" : "Auburn-Renton (NB AM)",
                        "StartPoint" : {
                            "Description" : "SR 167 @ 15th St NW in Auburn",
                            "Direction" : "N",
                            "Latitude" : 47.323000000,
                            "Longitude" : -122.244000000,
                            "MilePost" : 15.86,
                            "RoadName" : "SR 167"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 67
                    }, {
                        "AverageTime" : 10,
                        "CurrentTime" : 10,
                        "Description" : "Auburn to Renton using HOV lanes",
                        "Distance" : 9.76,
                        "EndPoint" : {
                            "Description" : "SR 167 @ I-405 in Renton",
                            "Direction" : "N",
                            "Latitude" : 47.458000000,
                            "Longitude" : -122.217000000,
                            "MilePost" : 25.62,
                            "RoadName" : "SR 167"
                        },
                        "Name" : "HOV Auburn-Renton (NB AM)",
                        "StartPoint" : {
                            "Description" : "SR 167 @ 15th St NW in Auburn",
                            "Direction" : "N",
                            "Latitude" : 47.323000000,
                            "Longitude" : -122.244000000,
                            "MilePost" : 15.86,
                            "RoadName" : "SR 167"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 68
                    }, {
                        "AverageTime" : 10,
                        "CurrentTime" : 10,
                        "Description" : "Renton to Auburn using HOV lanes",
                        "Distance" : 9.76,
                        "EndPoint" : {
                            "Description" : "SR 167 @ 15th St NW in Auburn",
                            "Direction" : "S",
                            "Latitude" : 47.323000000,
                            "Longitude" : -122.244000000,
                            "MilePost" : 15.86,
                            "RoadName" : "SR 167"
                        },
                        "Name" : "HOV Renton-Auburn (SB PM)",
                        "StartPoint" : {
                            "Description" : "SR 167 @ I-405 in Renton",
                            "Direction" : "S",
                            "Latitude" : 47.458000000,
                            "Longitude" : -122.217000000,
                            "MilePost" : 25.62,
                            "RoadName" : "SR 167"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 69
                    }, {
                        "AverageTime" : 12,
                        "CurrentTime" : 11,
                        "Description" : "Renton to Auburn",
                        "Distance" : 9.76,
                        "EndPoint" : {
                            "Description" : "SR 167 @ 15th St NW in Auburn",
                            "Direction" : "S",
                            "Latitude" : 47.323000000,
                            "Longitude" : -122.244000000,
                            "MilePost" : 15.86,
                            "RoadName" : "SR 167"
                        },
                        "Name" : "Renton-Auburn (SB PM)",
                        "StartPoint" : {
                            "Description" : "SR 167 @ I-405 in Renton",
                            "Direction" : "S",
                            "Latitude" : 47.458000000,
                            "Longitude" : -122.217000000,
                            "MilePost" : 25.62,
                            "RoadName" : "SR 167"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 70
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 16,
                        "Description" : "Issaquah to Downtown Seattle using HOV lanes",
                        "Distance" : 15.48,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Issaquah-Seattle (WB PM)",
                        "StartPoint" : {
                            "Description" : "I-90 @ Front St in Issaquah",
                            "Direction" : "W",
                            "Latitude" : 47.541799000,
                            "Longitude" : -122.037396000,
                            "MilePost" : 16.96,
                            "RoadName" : "I-90"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 71
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 16,
                        "Description" : "Downtown Seattle to Issaquah using HOV lanes",
                        "Distance" : 15.71,
                        "EndPoint" : {
                            "Description" : "I-90 @ Front St in Issaquah",
                            "Direction" : "E",
                            "Latitude" : 47.541799000,
                            "Longitude" : -122.037396000,
                            "MilePost" : 16.96,
                            "RoadName" : "I-90"
                        },
                        "Name" : "HOV Downtown Seattle-Issaquah (EB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 72
                    }, {
                        "AverageTime" : 17,
                        "CurrentTime" : 16,
                        "Description" : "Issaquah to Downtown Seattle",
                        "Distance" : 15.48,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Issaquah-Seattle (WB PM)",
                        "StartPoint" : {
                            "Description" : "I-90 @ Front St in Issaquah",
                            "Direction" : "W",
                            "Latitude" : 47.541799000,
                            "Longitude" : -122.037396000,
                            "MilePost" : 16.96,
                            "RoadName" : "I-90"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 73
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 16,
                        "Description" : "Downtown Seattle to Issaquah",
                        "Distance" : 15.71,
                        "EndPoint" : {
                            "Description" : "I-90 @ Front St in Issaquah",
                            "Direction" : "E",
                            "Latitude" : 47.541799000,
                            "Longitude" : -122.037396000,
                            "MilePost" : 16.96,
                            "RoadName" : "I-90"
                        },
                        "Name" : "Seattle-Issaquah (EB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 74
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Issaquah to Downtown Seattle using express lanes and HOV lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Issaquah-Seattle (WB REV)",
                        "StartPoint" : {
                            "Description" : "I-90 @ Front St in Issaquah",
                            "Direction" : "W",
                            "Latitude" : 47.541799000,
                            "Longitude" : -122.037396000,
                            "MilePost" : 16.96,
                            "RoadName" : "I-90"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 75
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Issaquah to Downtown Seattle using express lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Issaquah-Seattle (WB REV)",
                        "StartPoint" : {
                            "Description" : "I-90 @ Front St in Issaquah",
                            "Direction" : "W",
                            "Latitude" : 47.541799000,
                            "Longitude" : -122.037396000,
                            "MilePost" : 16.96,
                            "RoadName" : "I-90"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 76
                    }, {
                        "AverageTime" : 17,
                        "CurrentTime" : 18,
                        "Description" : "Redmond to Downtown Seattle using HOV lanes",
                        "Distance" : 14.60,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Redmond-Seattle (WB PM)",
                        "StartPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "W",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.65,
                            "RoadName" : "SR 520"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 77
                    }, {
                        "AverageTime" : 15,
                        "CurrentTime" : 15,
                        "Description" : "Downtown Seattle to Redmond using HOV lanes",
                        "Distance" : 14.56,
                        "EndPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "E",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.66,
                            "RoadName" : "SR 520"
                        },
                        "Name" : "HOV Seattle-Redmond (EB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 78
                    }, {
                        "AverageTime" : 18,
                        "CurrentTime" : 19,
                        "Description" : "Redmond to Downtown Seattle",
                        "Distance" : 14.60,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Redmond-Seattle (WB PM)",
                        "StartPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "W",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.65,
                            "RoadName" : "SR 520"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 79
                    }, {
                        "AverageTime" : 15,
                        "CurrentTime" : 15,
                        "Description" : "Downtown Seattle to Redmond",
                        "Distance" : 14.56,
                        "EndPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "E",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.66,
                            "RoadName" : "SR 520"
                        },
                        "Name" : "Seattle-Redmond (EB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 80
                    }, {
                        "AverageTime" : 22,
                        "CurrentTime" : 21,
                        "Description" : "Redmond to Downtown Seattle using HOV lanes via I-90",
                        "Distance" : 18.21,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Redmond-Seattle via I-90 (WB PM)",
                        "StartPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "W",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.65,
                            "RoadName" : "SR 520"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 81
                    }, {
                        "AverageTime" : 19,
                        "CurrentTime" : 19,
                        "Description" : "Downtown Seattle to Redmond via I-90 using HOV lanes",
                        "Distance" : 17.22,
                        "EndPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "E",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.66,
                            "RoadName" : "SR 520"
                        },
                        "Name" : "HOV Seattle-Redmond via I-90 (EB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 82
                    }, {
                        "AverageTime" : 25,
                        "CurrentTime" : 22,
                        "Description" : "Redmond to Downtown Seattle via I-90",
                        "Distance" : 18.19,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Redmond-Seattle via I-90 (WB PM)",
                        "StartPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "W",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.65,
                            "RoadName" : "SR 520"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 83
                    }, {
                        "AverageTime" : 19,
                        "CurrentTime" : 19,
                        "Description" : "Downtown Seattle to Redmond via I-90",
                        "Distance" : 17.22,
                        "EndPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "E",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.66,
                            "RoadName" : "SR 520"
                        },
                        "Name" : "Seattle-Redmond via I-90 (EB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 84
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Redmond to Downtown Seattle via I-90 using express lanes and HOV lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Redmond-Seattle via I-90 (WB REV)",
                        "StartPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "W",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.65,
                            "RoadName" : "SR 520"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 85
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Redmond to Downtown Seattle via I-90 using express lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Redmond-Seattle via I-90 (WB REV)",
                        "StartPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "W",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.65,
                            "RoadName" : "SR 520"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 86
                    }, {
                        "AverageTime" : 14,
                        "CurrentTime" : 13,
                        "Description" : "Downtown Bellevue to Downtown Seattle using SR 520",
                        "Distance" : 9.73,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Bellevue-Seattle via 520 (WB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 89
                    }, {
                        "AverageTime" : 13,
                        "CurrentTime" : 13,
                        "Description" : "Downtown Bellevue to Downtown Seattle via SR 520 using HOV lanes",
                        "Distance" : 9.73,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Bellevue-Seattle via 520 (WB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 90
                    }, {
                        "AverageTime" : 11,
                        "CurrentTime" : 11,
                        "Description" : "Downtown Seattle to Downtown Bellevue via SR 520 using HOV lanes",
                        "Distance" : 9.67,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Seattle-Bellevue via 520 (EB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 91
                    }, {
                        "AverageTime" : 11,
                        "CurrentTime" : 11,
                        "Description" : "Downtown Seattle to Downtown Bellevue via SR 520",
                        "Distance" : 9.67,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Seattle-Bellevue via 520 (EB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 92
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 13,
                        "Description" : "Downtown Bellevue to Downtown Seattle using I-90",
                        "Distance" : 10.58,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Bellevue-Seattle via I-90 (WB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 93
                    }, {
                        "AverageTime" : 13,
                        "CurrentTime" : 13,
                        "Description" : "Downtown Bellevue to Downtown Seattle via I-90 using HOV lanes",
                        "Distance" : 10.60,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Bellevue-Seattle via I-90 (WB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 94
                    }, {
                        "AverageTime" : 12,
                        "CurrentTime" : 11,
                        "Description" : "Downtown Seattle to Downtown Bellevue via I-90 using HOV lanes",
                        "Distance" : 10.60,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Seattle-Bellevue via I-90 (EB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 95
                    }, {
                        "AverageTime" : 12,
                        "CurrentTime" : 12,
                        "Description" : "Downtown Seattle to Downtown Bellevue via I-90",
                        "Distance" : 10.60,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Seattle-Bellevue via I-90 (EB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 96
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Downtown Bellevue to Downtown Seattle via I-90 using express lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Bellevue-Seattle via I-90 (WB REV)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 97
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Downtown Bellevue to Downtown Seattle via I-90 using express lanes and HOV lanes",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Bellevue-Seattle via I-90 (WB REV)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 98
                    }, {
                        "AverageTime" : 7,
                        "CurrentTime" : 7,
                        "Description" : "Downtown Bellevue to Redmond",
                        "Distance" : 6.62,
                        "EndPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "E",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.66,
                            "RoadName" : "SR 520"
                        },
                        "Name" : "Bellevue-Redmond (EB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 99
                    }, {
                        "AverageTime" : 7,
                        "CurrentTime" : 7,
                        "Description" : "Downtown Bellevue to Redmond using HOV lanes",
                        "Distance" : 6.62,
                        "EndPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "E",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.66,
                            "RoadName" : "SR 520"
                        },
                        "Name" : "HOV Bellevue-Redmond (EB PM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 100
                    }, {
                        "AverageTime" : 9,
                        "CurrentTime" : 9,
                        "Description" : "Redmond to Downtown Bellevue using HOV lanes",
                        "Distance" : 7.61,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Redmond-Bellevue (WB PM)",
                        "StartPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "W",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.65,
                            "RoadName" : "SR 520"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 101
                    }, {
                        "AverageTime" : 10,
                        "CurrentTime" : 9,
                        "Description" : "Redmond to Downtown Bellevue",
                        "Distance" : 7.61,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "S",
                            "Latitude" : 47.613800000,
                            "Longitude" : -122.188920000,
                            "MilePost" : 13.33,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Redmond-Bellevue (WB PM)",
                        "StartPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "W",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.65,
                            "RoadName" : "SR 520"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 102
                    }, {
                        "AverageTime" : 78,
                        "CurrentTime" : 74,
                        "Description" : "North Bend to Ellensburg Eastbound",
                        "Distance" : 74.90,
                        "EndPoint" : {
                            "Description" : "I-90 @ Ellensburg Exit 109",
                            "Direction" : "E",
                            "Latitude" : 47.011288000,
                            "Longitude" : -120.599140000,
                            "MilePost" : 109.45,
                            "RoadName" : "I-90"
                        },
                        "Name" : "Snoqualmie Pass EB",
                        "StartPoint" : {
                            "Description" : "I-90 @ 436th Ave \/ Exit 34",
                            "Direction" : "E",
                            "Latitude" : 47.473234000,
                            "Longitude" : -121.751422000,
                            "MilePost" : 35.02,
                            "RoadName" : "I-90"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 114
                    }, {
                        "AverageTime" : 78,
                        "CurrentTime" : 78,
                        "Description" : "Ellensburg to North Bend Westbound",
                        "Distance" : 78.56,
                        "EndPoint" : {
                            "Description" : "I-90 @ North Bend Exit 31",
                            "Direction" : "W",
                            "Latitude" : 47.484935000,
                            "Longitude" : -121.792834000,
                            "MilePost" : 30.90,
                            "RoadName" : "I-90"
                        },
                        "Name" : "Snoqualmie Pass WB",
                        "StartPoint" : {
                            "Description" : "I-90 @ Ellensburg Exit 109",
                            "Direction" : "W",
                            "Latitude" : 46.973870000,
                            "Longitude" : -120.540695000,
                            "MilePost" : 109.00,
                            "RoadName" : "I-90"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 115
                    }, {
                        "AverageTime" : 6,
                        "CurrentTime" : 8,
                        "Description" : "Marvin Rd.\/SR510 in Lacey To 14th Ave. in Olympia",
                        "Distance" : 6.62,
                        "EndPoint" : {
                            "Description" : "I-5 @ 14th Ave in Olympia",
                            "Direction" : "S",
                            "Latitude" : 47.032492000,
                            "Longitude" : -122.891484000,
                            "MilePost" : 105.38,
                            "RoadName" : "I-5"
                        },
                        "Name" : "SB I-5, Lacey (SR510) to Olympia",
                        "StartPoint" : {
                            "Description" : "I-5 @ Marvin Rd I\/C in Lacey",
                            "Direction" : "S",
                            "Latitude" : 47.063148000,
                            "Longitude" : -122.762735000,
                            "MilePost" : 112.00,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 116
                    }, {
                        "AverageTime" : 6,
                        "CurrentTime" : 6,
                        "Description" : "JBLM Main Gate to Lakewood at SR512",
                        "Distance" : 6.31,
                        "EndPoint" : {
                            "Description" : "I-5 @ SR512 in Lakewood",
                            "Direction" : "N",
                            "Latitude" : 47.162742000,
                            "Longitude" : -122.480759000,
                            "MilePost" : 127.35,
                            "RoadName" : "I-5"
                        },
                        "Name" : "NB I-5, JBLM Main Gate to Lakewood (SR512)",
                        "StartPoint" : {
                            "Description" : "I-5 @ JBLM Main Gate NB",
                            "Direction" : "N",
                            "Latitude" : 47.104090000,
                            "Longitude" : -122.588362000,
                            "MilePost" : 121.04,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 120
                    }, {
                        "AverageTime" : 6,
                        "CurrentTime" : 7,
                        "Description" : "SR512 in Lakewood To JBLM Main Gate",
                        "Distance" : 6.31,
                        "EndPoint" : {
                            "Description" : "I-5 @ JLBM Main Gate",
                            "Direction" : "S",
                            "Latitude" : 47.104090000,
                            "Longitude" : -122.588362000,
                            "MilePost" : 121.04,
                            "RoadName" : "I-5"
                        },
                        "Name" : "SB I-5, Lakewood (SR512) to JBLM Main Gate",
                        "StartPoint" : {
                            "Description" : "I-5 @ SR512 in Lakewood SB",
                            "Direction" : "S",
                            "Latitude" : 47.162742000,
                            "Longitude" : -122.480759000,
                            "MilePost" : 127.35,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 121
                    }, {
                        "AverageTime" : 6,
                        "CurrentTime" : 8,
                        "Description" : "SR512 in Lakewood To M St. in Tacoma",
                        "Distance" : 6.74,
                        "EndPoint" : {
                            "Description" : "I-5 @ Tacoma Dome in Tacoma",
                            "Direction" : "N",
                            "Latitude" : 47.234492000,
                            "Longitude" : -122.427958000,
                            "MilePost" : 134.09,
                            "RoadName" : "I-5"
                        },
                        "Name" : "NB I-5,Lakewood at SR512 To Tacoma",
                        "StartPoint" : {
                            "Description" : "I-5 @ SR512 in Lakewood NB",
                            "Direction" : "N",
                            "Latitude" : 47.162742000,
                            "Longitude" : -122.480759000,
                            "MilePost" : 127.35,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 122
                    }, {
                        "AverageTime" : 6,
                        "CurrentTime" : 7,
                        "Description" : "M St.in Tacoma To SR512 in Lakewood",
                        "Distance" : 6.74,
                        "EndPoint" : {
                            "Description" : "I-5 @ SR512 in Lakewood",
                            "Direction" : "S",
                            "Latitude" : 47.162742000,
                            "Longitude" : -122.480759000,
                            "MilePost" : 127.35,
                            "RoadName" : "I-5"
                        },
                        "Name" : "SB I-5,Tacoma To Lakewood at SR512",
                        "StartPoint" : {
                            "Description" : "I-5 @ M St. in Tacoma SB",
                            "Direction" : "S",
                            "Latitude" : 47.229950000,
                            "Longitude" : -122.442040000,
                            "MilePost" : 134.09,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 123
                    }, {
                        "AverageTime" : 5,
                        "CurrentTime" : 6,
                        "Description" : "M St. in Tacoma To NB I-5 @ Pierce King County Line",
                        "Distance" : 5.32,
                        "EndPoint" : {
                            "Description" : "I-5 @ Pierce King County Line",
                            "Direction" : "N",
                            "Latitude" : 47.255624000,
                            "Longitude" : -122.331130000,
                            "MilePost" : 139.41,
                            "RoadName" : "I-5"
                        },
                        "Name" : "NB I-5,Tacoma To Pierce King County Line",
                        "StartPoint" : {
                            "Description" : "I-5 @ Tacoma Dome in Tacoma",
                            "Direction" : "N",
                            "Latitude" : 47.234492000,
                            "Longitude" : -122.427958000,
                            "MilePost" : 134.09,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 125
                    }, {
                        "AverageTime" : 29,
                        "CurrentTime" : 31,
                        "Description" : "14th Ave. in Olympia to M St. in Tacoma",
                        "Distance" : 28.77,
                        "EndPoint" : {
                            "Description" : "I-5 @ Tacoma Dome in Tacoma",
                            "Direction" : "N",
                            "Latitude" : 47.234492000,
                            "Longitude" : -122.427958000,
                            "MilePost" : 134.09,
                            "RoadName" : "I-5"
                        },
                        "Name" : "NB I-5, Olympia To Tacoma",
                        "StartPoint" : {
                            "Description" : "I-5 @ 14th Ave in Olympia",
                            "Direction" : "N",
                            "Latitude" : 47.064447000,
                            "Longitude" : -122.759508000,
                            "MilePost" : 105.38,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 126
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 16,
                        "Description" : "Downtown Seattle to Lynnwood using express lanes and HOV lanes",
                        "Distance" : 15.73,
                        "EndPoint" : {
                            "Description" : "I-5 @ 196th St SW in Lynnwood",
                            "Direction" : "N",
                            "Latitude" : 47.819545000,
                            "Longitude" : -122.279109000,
                            "MilePost" : 181.56,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Seattle-Lynnwood (NB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 128
                    }, {
                        "AverageTime" : 17,
                        "CurrentTime" : 16,
                        "Description" : "Downtown Seattle to Lynnwood using express lanes",
                        "Distance" : 15.73,
                        "EndPoint" : {
                            "Description" : "I-5 @ 196th St SW in Lynnwood",
                            "Direction" : "N",
                            "Latitude" : 47.819545000,
                            "Longitude" : -122.279109000,
                            "MilePost" : 181.56,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Seattle-Lynnwood (NB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 129
                    }, {
                        "AverageTime" : 6,
                        "CurrentTime" : 6,
                        "Description" : "Downtown Seattle to Northgate using express lanes",
                        "Distance" : 5.79,
                        "EndPoint" : {
                            "Description" : "I-5 @ NE Northgate Way in Northgate",
                            "Direction" : "N",
                            "Latitude" : 47.774180000,
                            "Longitude" : -122.329912000,
                            "MilePost" : 171.62,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Seattle-Shoreline (NB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 130
                    }, {
                        "AverageTime" : 28,
                        "CurrentTime" : 27,
                        "Description" : "Downtown Seattle to Everett using express lanes and HOV lanes",
                        "Distance" : 26.94,
                        "EndPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "N",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.77,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Seattle-Everett (NB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 131
                    }, {
                        "AverageTime" : 33,
                        "CurrentTime" : 27,
                        "Description" : "Downtown Seattle to Everett using express lanes",
                        "Distance" : 26.94,
                        "EndPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "N",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.77,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Seattle-Everett (NB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 132
                    }, {
                        "AverageTime" : 20,
                        "CurrentTime" : 19,
                        "Description" : "Downtown Seattle to Redmond via I-90 using HOV lanes and express lanes",
                        "Distance" : 17.22,
                        "EndPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "E",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.66,
                            "RoadName" : "SR 520"
                        },
                        "Name" : "HOV Seattle-Redmond via I-90 (EB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 133
                    }, {
                        "AverageTime" : 19,
                        "CurrentTime" : 19,
                        "Description" : "Downtown Seattle to Redmond via I-90 using express lanes",
                        "Distance" : 17.22,
                        "EndPoint" : {
                            "Description" : "SR 520 @ Redmond Way in Redmond",
                            "Direction" : "E",
                            "Latitude" : 47.668087000,
                            "Longitude" : -122.110145000,
                            "MilePost" : 12.66,
                            "RoadName" : "SR 520"
                        },
                        "Name" : "Seattle-Redmond via I-90 (EB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 134
                    }, {
                        "AverageTime" : 12,
                        "CurrentTime" : 11,
                        "Description" : "Downtown Seattle to Downtown Bellevue via I-90 using express lanes and HOV lanes",
                        "Distance" : 10.60,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Seattle-Bellevue via I-90 (EB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 135
                    }, {
                        "AverageTime" : 12,
                        "CurrentTime" : 12,
                        "Description" : "Downtown Seattle to Downtown Bellevue via I-90 using express lanes",
                        "Distance" : 10.60,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Seattle-Bellevue via I-90 (EB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 136
                    }, {
                        "AverageTime" : 13,
                        "CurrentTime" : 13,
                        "Description" : "SR 531 in Arlington to 41st St in Everett",
                        "Distance" : 13.32,
                        "EndPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "S",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.55,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Arlington-Everett (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ EB 172nd St in Arlington",
                            "Direction" : "S",
                            "Latitude" : 48.152323000,
                            "Longitude" : -122.188847000,
                            "MilePost" : 205.87,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 266
                    }, {
                        "AverageTime" : 14,
                        "CurrentTime" : 13,
                        "Description" : "41st St in Everett to SR 531 in Arlington",
                        "Distance" : 13.10,
                        "EndPoint" : {
                            "Description" : "I-5 @ EB 172nd St in Arlington",
                            "Direction" : "N",
                            "Latitude" : 48.152323000,
                            "Longitude" : -122.188847000,
                            "MilePost" : 205.87,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Everett-Arlington (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "N",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.77,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 267
                    }, {
                        "AverageTime" : 8,
                        "CurrentTime" : 8,
                        "Description" : "41st St in Everett to 88th St NE in Marysville",
                        "Distance" : 7.89,
                        "EndPoint" : {
                            "Description" : "I-5 @ 88th St NE-SB in Marysville",
                            "Direction" : "N",
                            "Latitude" : 48.075728000,
                            "Longitude" : -122.184877000,
                            "MilePost" : 200.66,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Everett-Marysville (NB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "N",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.77,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 268
                    }, {
                        "AverageTime" : 8,
                        "CurrentTime" : 8,
                        "Description" : "88th St NE in Marysville to 41st St in Everett",
                        "Distance" : 8.11,
                        "EndPoint" : {
                            "Description" : "I-5 @ 41st St in Everett",
                            "Direction" : "S",
                            "Latitude" : 47.924280000,
                            "Longitude" : -122.265480000,
                            "MilePost" : 192.55,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Marysville-Everett (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 88th St NE-SB in Marysville",
                            "Direction" : "S",
                            "Latitude" : 48.075728000,
                            "Longitude" : -122.184877000,
                            "MilePost" : 200.66,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 269
                    }, {
                        "AverageTime" : 29,
                        "CurrentTime" : 18,
                        "Description" : "Lynnwood to Downtown Seattle using HOV lanes",
                        "Distance" : 15.23,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "HOV Lynnwood-Seattle (SB AM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 196th St SW in Lynnwood",
                            "Direction" : "S",
                            "Latitude" : 47.817269000,
                            "Longitude" : -122.285137000,
                            "MilePost" : 181.06,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 275
                    }, {
                        "AverageTime" : 11,
                        "CurrentTime" : 11,
                        "Description" : "Renton to Downtown Bellevue using HOV lanes",
                        "Distance" : 11.17,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "HOV Renton-Bellevue (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ SR 167 in Renton",
                            "Direction" : "N",
                            "Latitude" : 47.467434000,
                            "Longitude" : -122.219631000,
                            "MilePost" : 2.43,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 278
                    }, {
                        "AverageTime" : 14,
                        "CurrentTime" : 14,
                        "Description" : "Renton to Downtown Bellevue",
                        "Distance" : 11.17,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Renton-Bellevue (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ SR 167 in Renton",
                            "Direction" : "N",
                            "Latitude" : 47.467434000,
                            "Longitude" : -122.219631000,
                            "MilePost" : 2.43,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 279
                    }, {
                        "AverageTime" : 27,
                        "CurrentTime" : 27,
                        "Description" : "Downtown Seattle to Woodinville using express lanes and SR 522",
                        "Distance" : 15.37,
                        "EndPoint" : {
                            "Description" : "SR 522 @ SR 202 in Woodinville",
                            "Direction" : "2",
                            "Latitude" : 47.758180000,
                            "Longitude" : -122.164020000,
                            "MilePost" : 10.57,
                            "RoadName" : "522"
                        },
                        "Name" : "Seattle-Woodinville via SR 522 (EB REV)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 285
                    }, {
                        "AverageTime" : 28,
                        "CurrentTime" : 27,
                        "Description" : "Downtown Seattle to Woodinville",
                        "Distance" : 15.37,
                        "EndPoint" : {
                            "Description" : "SR 522 @ SR 202 in Woodinville",
                            "Direction" : "2",
                            "Latitude" : 47.758180000,
                            "Longitude" : -122.164020000,
                            "MilePost" : 10.57,
                            "RoadName" : "522"
                        },
                        "Name" : "Seattle-Woodinville via SR 522 Short (EB PM)-v2",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 286
                    }, {
                        "AverageTime" : 42,
                        "CurrentTime" : 38,
                        "Description" : "Woodinville to Downtown Seattle",
                        "Distance" : 15.54,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Woodinville-Seattle via SR 522 Short (WB AM)-v2",
                        "StartPoint" : {
                            "Description" : "SR 522 @ SR 202 in Woodinville",
                            "Direction" : "2",
                            "Latitude" : 47.758180000,
                            "Longitude" : -122.164020000,
                            "MilePost" : 10.56,
                            "RoadName" : "522"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 287
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 0,
                        "Description" : "Woodinville to Downtown Seattle",
                        "Distance" : 0.00,
                        "EndPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Woodinville-Seattle via SR 522 (SB REV)",
                        "StartPoint" : {
                            "Description" : "SR 522 @ SR 202 in Woodinville",
                            "Direction" : "2",
                            "Latitude" : 47.758180000,
                            "Longitude" : -122.164020000,
                            "MilePost" : 10.56,
                            "RoadName" : "522"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 288
                    }, {
                        "AverageTime" : 18,
                        "CurrentTime" : 16,
                        "Description" : "Tukwila to Downtown Bellevue",
                        "Distance" : 13.49,
                        "EndPoint" : {
                            "Description" : "I-405 @ NE 8th St in Bellevue",
                            "Direction" : "N",
                            "Latitude" : 47.613610000,
                            "Longitude" : -122.187970000,
                            "MilePost" : 13.60,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Tukwila-Bellevue (NB AM)",
                        "StartPoint" : {
                            "Description" : "I-405 @ I-5 in Tukwila",
                            "Direction" : "N",
                            "Latitude" : 47.463303000,
                            "Longitude" : -122.262701000,
                            "MilePost" : 0.11,
                            "RoadName" : "I-405"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 291
                    }, {
                        "AverageTime" : 4,
                        "CurrentTime" : 4,
                        "Description" : "So. 320th St. in Federal Way to King County Line",
                        "Distance" : 3.95,
                        "EndPoint" : {
                            "Description" : "I-5 @ King County Line MP 139.38",
                            "Direction" : "S",
                            "Latitude" : 47.334789000,
                            "Longitude" : -122.293778000,
                            "MilePost" : 139.69,
                            "RoadName" : "I-5"
                        },
                        "Name" : "Federal Way to King County Line",
                        "StartPoint" : {
                            "Description" : "I-5 @ So. 320th Street in Federal Way",
                            "Direction" : "S",
                            "Latitude" : 47.313840000,
                            "Longitude" : -122.298609000,
                            "MilePost" : 143.64,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 292
                    }, {
                        "AverageTime" : 4,
                        "CurrentTime" : 4,
                        "Description" : "Region boundary to Federal Way",
                        "Distance" : 4.29,
                        "EndPoint" : {
                            "Description" : "I-5 @ So. 320th St in Federal Way",
                            "Direction" : "N",
                            "Latitude" : 47.315446000,
                            "Longitude" : -122.296702000,
                            "MilePost" : 143.98,
                            "RoadName" : "I-5"
                        },
                        "Name" : "King County Line to Federal Way",
                        "StartPoint" : {
                            "Description" : "I-5 @ King County Line MP 139.38",
                            "Direction" : "N",
                            "Latitude" : 47.334789000,
                            "Longitude" : -122.293778000,
                            "MilePost" : 139.69,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 293
                    }, {
                        "AverageTime" : 23,
                        "CurrentTime" : 26,
                        "Description" : "Downtown Seattle to Woodinville",
                        "Distance" : 20.53,
                        "EndPoint" : {
                            "Description" : "SR 522 @ SR 202 in Woodinville",
                            "Direction" : "N",
                            "Latitude" : 47.758180000,
                            "Longitude" : -122.164020000,
                            "MilePost" : 23.01,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Seattle-Woodinville via I-90 (EB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "S",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 294
                    }, {
                        "AverageTime" : 20,
                        "CurrentTime" : 22,
                        "Description" : "Downtown Seattle to Woodinville",
                        "Distance" : 17.85,
                        "EndPoint" : {
                            "Description" : "SR 522 @ SR 202 in Woodinville",
                            "Direction" : "N",
                            "Latitude" : 47.758180000,
                            "Longitude" : -122.164020000,
                            "MilePost" : 23.01,
                            "RoadName" : "I-405"
                        },
                        "Name" : "Seattle-Woodinville via SR 520 (EB PM)",
                        "StartPoint" : {
                            "Description" : "I-5 @ University St in Seattle",
                            "Direction" : "N",
                            "Latitude" : 47.609294000,
                            "Longitude" : -122.331759000,
                            "MilePost" : 165.83,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 295
                    }, {
                        "AverageTime" : 9,
                        "CurrentTime" : 11,
                        "Description" : "Tacoma Dome in Tacoma To NB I-5 @ So. 320th St in Federal Way",
                        "Distance" : 9.89,
                        "EndPoint" : {
                            "Description" : "I-5 @ So. 320th St in Federal Way",
                            "Direction" : "5",
                            "Latitude" : 47.315446000,
                            "Longitude" : -122.296702000,
                            "MilePost" : 143.98,
                            "RoadName" : "005"
                        },
                        "Name" : "NB I-5,Tacoma To Federal Way",
                        "StartPoint" : {
                            "Description" : "I-5 @ Tacoma Dome in Tacoma",
                            "Direction" : "N",
                            "Latitude" : 47.234492000,
                            "Longitude" : -122.427958000,
                            "MilePost" : 134.09,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 303
                    }, {
                        "AverageTime" : 6,
                        "CurrentTime" : 7,
                        "Description" : "Olympia to Marvin Rd SR510 in Lacey",
                        "Distance" : 6.62,
                        "EndPoint" : {
                            "Description" : "I-5 @ Marvin Rd I\/C in Lacey",
                            "Direction" : "N",
                            "Latitude" : 47.063333000,
                            "Longitude" : -122.765327000,
                            "MilePost" : 112.00,
                            "RoadName" : "I-5"
                        },
                        "Name" : "NB I-5 Olympia to Lacey (SR510)",
                        "StartPoint" : {
                            "Description" : "I-5 @ 14th Ave in Olympia",
                            "Direction" : "N",
                            "Latitude" : 47.032492000,
                            "Longitude" : -122.891484000,
                            "MilePost" : 105.38,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 310
                    }, {
                        "AverageTime" : 9,
                        "CurrentTime" : 11,
                        "Description" : "JBLM Main Gate to Marvin Rd SR510 in Lacey",
                        "Distance" : 9.10,
                        "EndPoint" : {
                            "Description" : "I-5 @ Marvin Rd SR510 in Lacey",
                            "Direction" : "S",
                            "Latitude" : 47.063333000,
                            "Longitude" : -122.765327000,
                            "MilePost" : 112.00,
                            "RoadName" : "I-5"
                        },
                        "Name" : "SB I-5 JBLM Main Gate to Lacey (SR510) SB",
                        "StartPoint" : {
                            "Description" : "I-5 @ JBLM Main Gate",
                            "Direction" : "S",
                            "Latitude" : 47.104090000,
                            "Longitude" : -122.588362000,
                            "MilePost" : 121.04,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 311
                    }, {
                        "AverageTime" : 9,
                        "CurrentTime" : 10,
                        "Description" : "Marvin Rd.\/SR510 in Lacey To JBLM Main Gate",
                        "Distance" : 9.10,
                        "EndPoint" : {
                            "Description" : "I-5 @ JBLM Main Gate",
                            "Direction" : "N",
                            "Latitude" : 47.104090000,
                            "Longitude" : -122.588362000,
                            "MilePost" : 121.04,
                            "RoadName" : "I-5"
                        },
                        "Name" : "NB I-5 Lacey (SR510) to JBLM Main Gate",
                        "StartPoint" : {
                            "Description" : "I-5 @ Marvin Rd IC in Lacey",
                            "Direction" : "N",
                            "Latitude" : 47.063333000,
                            "Longitude" : -122.765327000,
                            "MilePost" : 112.00,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 312
                    }, {
                        "AverageTime" : 28,
                        "CurrentTime" : 32,
                        "Description" : "M St in Tacoma To 14th Ave in Olympia",
                        "Distance" : 28.77,
                        "EndPoint" : {
                            "Description" : "I-5 @ 14th Ave in Olympia",
                            "Direction" : "S",
                            "Latitude" : 47.064447000,
                            "Longitude" : -122.759508000,
                            "MilePost" : 105.38,
                            "RoadName" : "I-5"
                        },
                        "Name" : "SB I-5 Tacoma To Olympia",
                        "StartPoint" : {
                            "Description" : "I-5 @ Tacoma Dome in Tacoma",
                            "Direction" : "S",
                            "Latitude" : 47.234492000,
                            "Longitude" : -122.427958000,
                            "MilePost" : 134.09,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 313
                    }, {
                        "AverageTime" : 5,
                        "CurrentTime" : 6,
                        "Description" : "Pierce King County Line to Tacoma Dome",
                        "Distance" : 5.32,
                        "EndPoint" : {
                            "Description" : "I-5 @ Tacoma Dome in Tacoma",
                            "Direction" : "S",
                            "Latitude" : 47.234492000,
                            "Longitude" : -122.427958000,
                            "MilePost" : 134.09,
                            "RoadName" : "I-5"
                        },
                        "Name" : "SB I-5 Pierce King County Line To Tacoma",
                        "StartPoint" : {
                            "Description" : "I-5 @ Pierce King County Line",
                            "Direction" : "S",
                            "Latitude" : 47.255624000,
                            "Longitude" : -122.331130000,
                            "MilePost" : 139.41,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 314
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 15,
                        "Description" : "Region boundary to Tukwila",
                        "Distance" : 15.11,
                        "EndPoint" : {
                            "Description" : "I-5 @ I-405 in Tukwila",
                            "Direction" : "N",
                            "Latitude" : 47.463303000,
                            "Longitude" : -122.262701000,
                            "MilePost" : 154.80,
                            "RoadName" : "I-5"
                        },
                        "Name" : "King County Line to Tukwila",
                        "StartPoint" : {
                            "Description" : "I-5 @ King County Line MP 139.38",
                            "Direction" : "N",
                            "Latitude" : 47.334789000,
                            "Longitude" : -122.293778000,
                            "MilePost" : 139.69,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 316
                    }, {
                        "AverageTime" : 0,
                        "CurrentTime" : 9,
                        "Description" : "Marvin Rd SR510 in Lacey To JBLM Main Gate",
                        "Distance" : 8.49,
                        "EndPoint" : {
                            "Description" : "I-5 @ JBLM Main Gate",
                            "Direction" : "N",
                            "Latitude" : 47.103130000,
                            "Longitude" : -122.595879000,
                            "MilePost" : 121.04,
                            "RoadName" : "I-5"
                        },
                        "Name" : "NB I-5, SR510 to JBLM Main Gate",
                        "StartPoint" : {
                            "Description" : "",
                            "Direction" : "N",
                            "Latitude" : 0.000000000,
                            "Longitude" : 0.000000000,
                            "MilePost" : 112.61,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 317
                    }, {
                        "AverageTime" : 16,
                        "CurrentTime" : 16,
                        "Description" : "N\/O Marvin Rd SR510 in Lacey To SR 512 in Lakewood",
                        "Distance" : 14.85,
                        "EndPoint" : {
                            "Description" : "I-5 @ SR 512 in Lakewood",
                            "Direction" : "N",
                            "Latitude" : 47.163299000,
                            "Longitude" : -122.479422000,
                            "MilePost" : 127.40,
                            "RoadName" : "I-5"
                        },
                        "Name" : "NB I-5 SR510 to SR 512",
                        "StartPoint" : {
                            "Description" : "",
                            "Direction" : "N",
                            "Latitude" : 0.000000000,
                            "Longitude" : 0.000000000,
                            "MilePost" : 112.61,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 318
                    }, {
                        "AverageTime" : 7,
                        "CurrentTime" : 8,
                        "Description" : "Mounts Rd in DuPont To Sleeter Kinney Rd. in Lacey",
                        "Distance" : 6.99,
                        "EndPoint" : {
                            "Description" : "I-5 @ Martin Way E in Lacey",
                            "Direction" : "S",
                            "Latitude" : 47.047436000,
                            "Longitude" : -122.821408000,
                            "MilePost" : 109.18,
                            "RoadName" : "I-5"
                        },
                        "Name" : "SB I-5 DuPont To Lacey",
                        "StartPoint" : {
                            "Description" : "",
                            "Direction" : "S",
                            "Latitude" : 0.000000000,
                            "Longitude" : 0.000000000,
                            "MilePost" : 116.17,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 321
                    }, {
                        "AverageTime" : 18,
                        "CurrentTime" : 19,
                        "Description" : "112th St in Lakewood To Martin Way in Lacey",
                        "Distance" : 17.52,
                        "EndPoint" : {
                            "Description" : "I-5 @ Martin Way in Lacey",
                            "Direction" : "S",
                            "Latitude" : 47.048034000,
                            "Longitude" : -122.820155000,
                            "MilePost" : 109.18,
                            "RoadName" : "I-5"
                        },
                        "Name" : "SB I-5 Lakewood To Lacey",
                        "StartPoint" : {
                            "Description" : "",
                            "Direction" : "S",
                            "Latitude" : 0.000000000,
                            "Longitude" : 0.000000000,
                            "MilePost" : 126.64,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 324
                    }, {
                        "AverageTime" : 4,
                        "CurrentTime" : 4,
                        "Description" : "Region boundary to Federal Way via HOV lanes",
                        "Distance" : 4.29,
                        "EndPoint" : {
                            "Description" : "I-5 @ S 320th St in Federal Way",
                            "Direction" : "N",
                            "Latitude" : 47.315446000,
                            "Longitude" : -122.296702000,
                            "MilePost" : 143.98,
                            "RoadName" : "I-5"
                        },
                        "Name" : "King County Line to Federal Way HOV",
                        "StartPoint" : {
                            "Description" : "I-5 @ King County Line MP 139.38",
                            "Direction" : "N",
                            "Latitude" : 47.334789000,
                            "Longitude" : -122.293778000,
                            "MilePost" : 139.69,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 326
                    }, {
                        "AverageTime" : 15,
                        "CurrentTime" : 15,
                        "Description" : "Region boundary to Tukwila via HOV lanes",
                        "Distance" : 15.11,
                        "EndPoint" : {
                            "Description" : "I-5 @ I-405 in Tukwila",
                            "Direction" : "N",
                            "Latitude" : 47.463303000,
                            "Longitude" : -122.262701000,
                            "MilePost" : 154.80,
                            "RoadName" : "I-5"
                        },
                        "Name" : "King County Line to Tukwila HOV",
                        "StartPoint" : {
                            "Description" : "I-5 @ King County Line MP 139.38",
                            "Direction" : "N",
                            "Latitude" : 47.334789000,
                            "Longitude" : -122.293778000,
                            "MilePost" : 139.69,
                            "RoadName" : "I-5"
                        },
                        "TimeUpdated" : "\/Date(1443646200000-0700)\/",
                        "TravelTimeID" : 327
                    }
                ];
            }
    }
})();
