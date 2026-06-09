allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// Force Flutter plugin subprojects to compile against SDK 36.
// Skip :app — it already has compileSdk=36 and is evaluated early by
// evaluationDependsOn(":app"), which would make afterEvaluate crash.
subprojects {
    if (project.name != "app") {
        afterEvaluate {
            if (extensions.findByName("android") != null) {
                extensions.configure<com.android.build.gradle.BaseExtension>("android") {
                    compileSdkVersion(36)
                }
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
