if (! this.WxConfig)
{
    this.WxConfig = { };
}

(function ()
{
    this.WxConfig =
    {
        debug: false,

        // forecast.io API info

        forecastIO:
            {
                // Set with your own forecast.io API key and location.
                // You can obtain a free API key good for 1000 requests a day
                // at https://developer.forecast.io.

                apiKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',

                // Set with your own latitude and longitude.

                loc: 
                    {
                        latitude: 47.609722,
                        longitude: -122.333056
                    }
            },

        // wsdot.com API info

        wsdot:
            {
                // Set with your own wsdot.com API key.
                // You can obtain one at http://wsdot.com/traffic/api.

                apiKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
            }
    }

})();
