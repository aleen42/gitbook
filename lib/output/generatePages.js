var path = require('path');
var fs = require('fs');

var Promise = require('../utils/promise');
var generatePage = require('./generatePage');
var fileToOutput = require('./helper/fileToOutput');

/**
    Output all pages using a generator

    @param {Generator} generator
    @param {Output} output
    @return {Promise<Output>}
*/
function generatePages(generator, output) {
    var pages = output.getPages();
    var logger = output.getLogger();

    // Is generator ignoring assets?
    if (!generator.onPage) {
        return Promise(output);
    }

    return Promise.reduce(pages, function(out, page) {
        var file = page.getFile();

        logger.debug.ln('generate page "' + file.getPath() + '"');

        var filePath = file.getPath();
        var absoluteFilePath = path.join(out.getBook().getContentRoot(), filePath);
        var outputFilePath = path.join(out.getRoot(), filePath);

        if (fs.existsSync(outputFilePath)
            && fs.readFileSync(absoluteFilePath, { encoding: 'utf-8' }).replace(/\r|\n|\t/gi, '') === fs.readFileSync(outputFilePath, { encoding: 'utf-8' }).replace(/\r|\n|\t/gi, '')
            && fs.existsSync(path.join(out.getRoot(), fileToOutput(out, filePath)))
        ) {
            return Promise(out, page);
        }

        /** copy markdown file to the output directory */
        var folderPath = path.dirname(outputFilePath);
        var checkParentFolder = function (folder) {
            var parentFolder = path.resolve(folder, '..')
            if (!fs.existsSync(parentFolder)) {
                checkParentFolder(parentFolder);
                fs.mkdirSync(parentFolder);
            }
        };

        if (!fs.existsSync(folderPath)) {
            checkParentFolder(folderPath);
            fs.mkdirSync(folderPath);
        }

        fs.createReadStream(absoluteFilePath).pipe(fs.createWriteStream(outputFilePath));

        return generatePage(out, page)
        .then(function(resultPage) {
            return generator.onPage(out, resultPage);
        })
        .fail(function(err) {
            logger.error.ln('error while generating page "' + file.getPath() + '":');
            throw err;
        });
    }, output);
}

module.exports = generatePages;
