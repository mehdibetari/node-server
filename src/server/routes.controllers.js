'use strict';
let dust = require('dustjs-linkedin');
let fs = require('fs');
let metaService = require('./meta.service');
const configServer = require('./config-server').configServer;
const Packager = require('../xspeedit/XspeedIt');
const configKeys = require('../config-keys');
const upcomings = require('../refresh-upcoming');
const tops = require('../vodt-run');

class RoutesControllers {
    constructor() {
    }

    getAbbrMonth() {
        return ['janv.', 'fev.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'aout', 'sept.', 'oct.', 'nov.', 'déc.'];
    }

    getFrMonth() {
        return ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin', 'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
    }

    getMonth() {
        return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    }

    calendarList (wish, req, res) {
        let layout;
        switch(wish) {
            case 'amp-netflix':
                layout = configServer.ALLOSERIE_NETFLIX_CALENDAR_AMP_LAYOUT;
            case 'netflix':
                layout = layout ? layout : configServer.ALLOSERIE_NETFLIX_CALENDAR_LAYOUT;
                fs.readFile(layout, 'utf8', (err,data) => {
                    if (err) {
                        return console.log(err);
                    }
                    fs.readFile(configServer.ALLOSERIE_NETFLIX_UPCOMING_STORE, 'utf8', (error,response) => {
                        if (error) {
                            return console.log(error);
                        }
                        const netflixUpcoming = JSON.parse(response);
                        netflixUpcoming.items.sort((a,b) => new Date(a.sortDate).getTime() - new Date(b.sortDate).getTime());
                        netflixUpcoming.items = this.removeMediaFromPreviousYear(netflixUpcoming.items);

                        const lastUpdateDate = new Date(netflixUpcoming.timeStamp);
                        const fullDate = lastUpdateDate.getDate()+'.'+(lastUpdateDate.getMonth()+1)+'.'+lastUpdateDate.getFullYear()+' à '+lastUpdateDate.getHours()+'h'+lastUpdateDate.getMinutes();
                        const frenchDate = `${lastUpdateDate.getDate()} ${this.getAbbrMonth()[lastUpdateDate.getMonth()]} ${lastUpdateDate.getFullYear()}`;
                        const currentMonth = this.getMonth()[lastUpdateDate.getMonth()];
                        const metaData = metaService.getMediaMetaData(req.params.media_id,netflixUpcoming.items, lastUpdateDate, configServer.ALLOSERIE_NETFLIX_CALENDAR_URL);
                        const structuredData = metaService.getStructuredData(this.filterMediaWithPicture(netflixUpcoming.items), lastUpdateDate);
                        const groups = this.groupByMonth(netflixUpcoming.items);

                        let tmpl = dust.compile(data, 'view-netflix');
                        dust.filters.unicorn = function(value) {
                            if (typeof value === 'string') {
                            return value.replace('/posters/./public/posters/', '/posters/');
                            }
                            return value;
                        };
                        dust.loadSource(tmpl);
                        let view = dust.render('view-netflix', { 
                            list: netflixUpcoming.items,
                            groups,
                            lastUpdate: fullDate,
                            humanDate: {
                                frenchDate,
                                currentMonth,
                                currentYear: lastUpdateDate.getFullYear(),
                                nextYear: lastUpdateDate.getFullYear() + 1
                            },
                            meta: metaData,
                            structuredData
                        }, 
                        function(e, out) {
                            if(e) {
                                console.error(e);
                            } else {
                                // Finally, we'll just send out a message to the browser reminding you that this app does not have a UI.
                                res.send(out);
                            }
                        });
                    });
                });
                break;
            case 'json-netflix':
                let file = configServer.ALLOSERIE_NETFLIX_UPCOMING_STORE;
                if (req.params.lang) {
                    file = `${configServer.ALLOSERIE_NETFLIX_UPCOMING_STORE_LANG}/${req.params.lang}.json`
                }

                fs.readFile(file, 'utf8', function (error,response) {
                    if (error) {
                        return console.log(error);
                    }
                    res.setHeader('Content-Type', 'application/json');
                    res.send(response);
                });
                break;
        }
    }

    topsList (req, res) {
        let file = configServer.ALLOSERIE_NETFLIX_TOPS_STORE;
        if (req.params.lang) {
            file = `.${configServer.ALLOSERIE_NETFLIX_TOPS_STORE_LANG}/tops/${req.params.lang}.json`
        }

        fs.readFile(file, 'utf8', function (error,response) {
            if (error) {
                return console.log(error);
            }
            res.setHeader('Content-Type', 'application/json');
            res.send(response);
        });
    }

    amazonTopsList (req, res) {
        let file = configServer.ALLOSERIE_AMAZON_TOPS_STORE;
        if (req.params.lang) {
            file = `.${configServer.ALLOSERIE_AMAZON_TOPS_STORE_LANG}/tops/${req.params.lang}.json`
        }

        fs.readFile(file, 'utf8', function (error,response) {
            if (error) {
                return console.log(error);
            }
            res.setHeader('Content-Type', 'application/json');
            res.send(response);
        });
    }

    weeklyList (wish, req, res) {
        fs.readFile(configServer.ALLOSERIE_NETFLIX_WEEKLY_LAYOUT, 'utf8', (err,data) => {
            if (err) {
                return console.log(err);
            }
            fs.readFile(configServer.ALLOSERIE_NETFLIX_WEEKLY_STORE, 'utf8', (error,response) => {
                if (error) {
                    return console.log(error);
                }
                const netflixEveryWeekData = JSON.parse(response);
                const lastUpdateDate = new Date(netflixEveryWeekData.timeStamp);
                const fullDate = lastUpdateDate.getDate()+'.'+(lastUpdateDate.getMonth()+1)+'.'+lastUpdateDate.getFullYear();
                const fullTime = lastUpdateDate.getHours()+'h'+(lastUpdateDate.getMinutes()<10?'0':'') + lastUpdateDate.getMinutes();
                const fullDateTime = fullDate+' à '+fullTime;
                const metaData = metaService.getMediaMetaData(req.params.media_id,netflixEveryWeekData.items, lastUpdateDate, configServer.ALLOSERIE_NETFLIX_WEEKLY_URL);
                const frenchDate = `${lastUpdateDate.getDate()} ${this.getAbbrMonth()[lastUpdateDate.getMonth()]} ${lastUpdateDate.getFullYear()}`;
                
                let tmpl = dust.compile(data, 'view-netflix');
                dust.loadSource(tmpl);
                let view = dust.render('view-netflix', { 
                    list: netflixEveryWeekData.items, 
                    lastUpdate: fullDateTime, 
                    theFooter: netflixEveryWeekData.footer,
                    meta: metaData,
                    frenchDate,
                    currentYear: lastUpdateDate.getFullYear()
                }, function(e, out) {
                    if(e) {
                        console.error(e);
                    } else {
                        // Finally, we'll just send out a message to the browser reminding you that this app does not have a UI.
                        res.send(out);
                    }
                });
            });
        });
    }

    home (req, res) {
        fs.readFile(configServer.ALLOSERIE_HOME_LAYOUT, 'utf8', function (err,data) {
            if (err) {
                return console.log(err);
            }
            const lastUpdateDate = new Date();
            const fullDate = (lastUpdateDate.getDate()-1)+'.'+(lastUpdateDate.getMonth()+1)+'.'+lastUpdateDate.getFullYear();

            let tmpl = dust.compile(data, 'view-netflix');
            dust.loadSource(tmpl);
            let view = dust.render('view-netflix', {lastUpdate: fullDate}, function(e, out) {
                if(e) {
                    console.error(e);
                } else {
                    // Finally, we'll just send out a message to the browser reminding you that this app does not have a UI.
                    res.send(out);
                }
            });
        });
    }

    xspeedit (req, res) {
        const packagerInstance = new Packager(req.params.input);
        res.setHeader('Content-Type', 'application/json');
        res.send({'packagedBoxes': packagerInstance.getBoxes(), 'count': packagerInstance.getBoxes().length});
    }

    refreshUpcomings (req, res) {
        let badParam = false;
        if (!req.params.key) {
            badParam = true;
        }
        else {
            if (req.params.key === configKeys.secretApi['private_key']) {
                upcomings(true);
                res.status(200).send('In progress');
            }
            else {
                badParam = true;
            }

        }
        if (badParam) res.status(404).send('Not found');
    }

    refreshTops (req, res) {
        let badParam = false;
        if (!req.params.key) {
            badParam = true;
        }
        else {
            if (req.params.key === configKeys.secretApi['private_key']) {
                tops('netflix');
                res.status(200).send('In progress');
            }
            else {
                badParam = true;
            }

        }
        if (badParam) res.status(404).send('Not found');
    }

    refreshAmazonTops (req, res) {
        let badParam = false;
        if (!req.params.key) {
            badParam = true;
        }
        else {
            if (req.params.key === configKeys.secretApi['private_key']) {
                tops('amazon');
                res.status(200).send('In progress');
            }
            else {
                badParam = true;
            }

        }
        if (badParam) res.status(404).send('Not found');
    }

    removeMediaFromPreviousYear (medias) {
        return medias.filter((item) => new Date(item.sortDate).getFullYear() != new Date().getFullYear() - 1);
    }

    filterMediaWithPicture(medias) {
        return medias.filter((item) => item.posterUrl);
    }

    groupByMonth(items) {
        let groups = [];
        items.map((item) => {
            const incomingDate = new Date(this.preFormatDate(item.premiereDate));
            const month = (item.premiereDate == incomingDate.getFullYear()) ? undefined : this.getMonth()[incomingDate.getMonth()];
            const year = incomingDate.getFullYear() ? incomingDate.getFullYear() : 'Sans date';
            const key = `${(incomingDate.getFullYear())?incomingDate.getFullYear():'withoutYear'}${(month)?'-':''}${(month)?month:''}`;
            const keyExistAt = groups.findIndex((group) => group.key === key);
            if (keyExistAt === -1) groups.push({ key, year, month: this.getFrMonth()[incomingDate.getMonth()], items: [item] });
            else groups[keyExistAt].items.push(item);
        });
        return groups;
    }

    preFormatDate(premiereDate) {
        return premiereDate
            .replace('é', 'e')
            .replace('fevrier', 'feb')
            .replace('avril', 'apr')
            .replace('mai', 'may')
            .replace('juin', 'jun')
            .replace('juillet', 'jul')
            .replace('aout', 'aug');
    }
}

module.exports = RoutesControllers;