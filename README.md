# wx-dashboard
Javascript-based dashboard for showing time, weather, and other information.

This very small project was largely inspired by https://github.com/HannahMitt/HomeMirror and my similar circumstance of having some old, bored technology around the house well past its sell-by date but still capable of achieving some small degree of technological self-actualization.

This application is written in completely in Javascript, jQuery, slightly out-of-date CSS, and slightly-out-of-date HTML4, largely because the technology it'll be running on is somewhat stale.  At present, this project generates a single webpage that integrates with the [http://forecast.io](https://developer.forecast.io/docs/v2) API to show the current time and current and forecasted weather at a single location of your choice.  A recent addition also provides customizable commute information.

The user interface is deliberately simple and customizable, with the black background intended to achieve the same form factor (mirror-mounted) and cool factor as HannahMitt's project without the requirement to go out and acquire an expired Android device.  I've tried to make the codeahead, javascript library, and CSS as accessible as possible.

# Screenshot

![wx-dashboard screenshot](https://github.com/eleuthero/wx-dashboard/blob/master/misc/wx-dashboard.png?raw=true "wx-dashboard screenshot")

# How do I work this ?

0. Acquire or excavate from the hall closet a tablet-like device.  In my case, it's an iPad that has managed to outlive most of its technological contemporaries and managed to really look good doing so.  It deserves a place of honor behind the mirror in the entryway.
1. Clone this project.
2. Get a [forecast.io API key](https://developer.forecast.io).
3. In `js/forecast-io.js`, assign your forecast.io API key to `_APIKEY`.  While you're there, under `_LOCATION`, also enter the latitude and the longitude of the location whose weather you wish to display.
4. If you happen to live in Washington state, you may be interested in enabling the commute information provided by the Washington State Department of Transportation.  If so, go to http://wsdot.com/traffic/api to get an API key and assign it to `_APIKEY` in `js/wsdot-commute.js`.  If your local transit authority makes similar information available, it shouldn't be too difficult to adapt this code to integrate with it.  If you are not interested in commuting information, you can remove all references to `wsdot-commute.js` in `index.html`.
5. Either load or copy all of the files not under the `misc` directory to the device and run `index.html`, or set it up on a server to be accessed by the device.  Your call.

# References

Special thanks to:

- Hannah Mittelstaedt's [HomeMirror](http://github.com/HannahMitt/HomeMirror) project for inspiration, ideas, and features.
- The weather images used by this project were sourced from the excellent [Material Design Icons](https://materialdesignicons.com).  I've included them in .psd format in case you wish to tinker with icons.  
