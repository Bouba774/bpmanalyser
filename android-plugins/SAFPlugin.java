package app.lovable.e61fee5bc92f456f8684aa0b1a8db0a3.plugins;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.UriPermission;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;

import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import android.media.MediaScannerConnection;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "SAFFolderPicker")
public class SAFPlugin extends Plugin {

    private static final Set<String> AUDIO_MIME_TYPES = new HashSet<>(Arrays.asList(
        "audio/mpeg",
        "audio/wav",
        "audio/x-wav",
        "audio/flac",
        "audio/aac",
        "audio/mp4",
        "audio/x-m4a",
        "audio/ogg",
        "audio/webm"
    ));

    private static final Set<String> AUDIO_EXTENSIONS = new HashSet<>(Arrays.asList(
        "mp3", "wav", "flac", "aac", "m4a", "ogg", "webm"
    ));

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(
            Intent.FLAG_GRANT_READ_URI_PERMISSION |
            Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
            Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION |
            Intent.FLAG_GRANT_PREFIX_URI_PERMISSION
        );
        startActivityForResult(call, intent, "handleFolderResult");
    }

    @ActivityCallback
    private void handleFolderResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Sélection de dossier annulée");
            return;
        }

        Uri treeUri = result.getData().getData();
        if (treeUri == null) {
            call.reject("URI du dossier invalide");
            return;
        }

        // Take persistable permission
        ContentResolver resolver = getContext().getContentResolver();
        int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
        resolver.takePersistableUriPermission(treeUri, takeFlags);

        DocumentFile folder = DocumentFile.fromTreeUri(getContext(), treeUri);
        if (folder == null || !folder.isDirectory()) {
            call.reject("Le dossier sélectionné est invalide");
            return;
        }

        JSObject ret = new JSObject();
        ret.put("folderUri", treeUri.toString());
        ret.put("folderName", folder.getName());

        JSArray filesArray = new JSArray();
        listAudioFilesRecursive(folder, filesArray);
        ret.put("files", filesArray);

        call.resolve(ret);
    }

    private void listAudioFilesRecursive(DocumentFile dir, JSArray filesArray) {
        if (dir == null) return;

        DocumentFile[] children = dir.listFiles();
        if (children == null) return;

        for (DocumentFile file : children) {
            if (file.isDirectory()) {
                listAudioFilesRecursive(file, filesArray);
            } else if (file.isFile()) {
                String name = file.getName();
                String mimeType = file.getType();
                boolean isAudio = false;

                // Check by MIME type
                if (mimeType != null && AUDIO_MIME_TYPES.contains(mimeType)) {
                    isAudio = true;
                }

                // Check by extension as fallback
                if (!isAudio && name != null) {
                    int dotIndex = name.lastIndexOf('.');
                    if (dotIndex > 0) {
                        String ext = name.substring(dotIndex + 1).toLowerCase();
                        if (AUDIO_EXTENSIONS.contains(ext)) {
                            isAudio = true;
                        }
                    }
                }

                if (isAudio) {
                    JSObject fileObj = new JSObject();
                    fileObj.put("uri", file.getUri().toString());
                    fileObj.put("name", name != null ? name : "unknown");
                    fileObj.put("mimeType", mimeType != null ? mimeType : "audio/*");
                    fileObj.put("size", file.length());
                    filesArray.put(fileObj);
                }
            }
        }
    }

    @PluginMethod
    public void readFileContent(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null) {
            call.reject("URI manquant");
            return;
        }

        try {
            Uri uri = Uri.parse(uriString);
            ContentResolver resolver = getContext().getContentResolver();
            InputStream inputStream = resolver.openInputStream(uri);

            if (inputStream == null) {
                call.reject("Impossible de lire le fichier");
                return;
            }

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            byte[] data = new byte[8192];
            int bytesRead;
            while ((bytesRead = inputStream.read(data)) != -1) {
                buffer.write(data, 0, bytesRead);
            }
            inputStream.close();

            String base64Data = Base64.encodeToString(buffer.toByteArray(), Base64.NO_WRAP);
            JSObject ret = new JSObject();
            ret.put("data", base64Data);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Erreur de lecture: " + e.getMessage());
        }
    }

    @PluginMethod
    public void renameFile(PluginCall call) {
        String uriString = call.getString("uri");
        String newName = call.getString("newName");

        if (uriString == null || newName == null) {
            call.reject("URI ou nouveau nom manquant");
            return;
        }

        try {
            Uri uri = Uri.parse(uriString);
            DocumentFile file = DocumentFile.fromSingleUri(getContext(), uri);

            if (file == null || !file.exists()) {
                JSObject ret = new JSObject();
                ret.put("success", false);
                ret.put("error", "Fichier introuvable");
                call.resolve(ret);
                return;
            }

            // Use DocumentsContract for rename (more reliable with SAF)
            Uri renamedUri = DocumentsContract.renameDocument(
                getContext().getContentResolver(),
                uri,
                newName
            );

            JSObject ret = new JSObject();
            if (renamedUri != null) {
                ret.put("success", true);
                ret.put("newUri", renamedUri.toString());

                // Force MediaStore rescan so DJ apps see the new filename
                try {
                    String filePath = getPathFromUri(renamedUri);
                    if (filePath != null) {
                        MediaScannerConnection.scanFile(
                            getContext(),
                            new String[]{filePath},
                            null,
                            null
                        );
                    } else {
                        // Fallback: broadcast scan intent with the URI
                        Intent scanIntent = new Intent(Intent.ACTION_MEDIA_SCANNER_SCAN_FILE);
                        scanIntent.setData(renamedUri);
                        getContext().sendBroadcast(scanIntent);

    /**
     * Attempt to resolve a file path from a SAF URI for MediaScanner.
     */
    private String getPathFromUri(Uri uri) {
        try {
            String docId = DocumentsContract.getDocumentId(uri);
            if (docId != null && docId.contains(":")) {
                String[] parts = docId.split(":");
                String type = parts[0];
                String relativePath = parts.length > 1 ? parts[1] : "";
                if ("primary".equalsIgnoreCase(type)) {
                    return android.os.Environment.getExternalStorageDirectory() + "/" + relativePath;
                }
            }
        } catch (Exception ignored) {}
        return null;
    }
}
                } catch (Exception ignored) {
                    // Non-critical: rename succeeded even if scan fails
                }
            } else {
                ret.put("success", false);
                ret.put("error", "Le renommage a échoué");
            }
            call.resolve(ret);
        } catch (Exception e) {
            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }
}
